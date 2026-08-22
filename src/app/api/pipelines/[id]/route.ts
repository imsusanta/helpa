import { NextRequest, NextResponse } from 'next/server';
import {
  ForbiddenError,
  UnauthorizedError,
  requireRole,
} from '@/lib/auth/account';
import { getAdminClient as getSupabaseAdminClient } from '@/lib/supabase/server';

const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store, no-cache, must-revalidate',
};

function requestId(request: NextRequest): string {
  return request.headers.get('x-request-id') ?? crypto.randomUUID();
}

function errorResponse(
  status: number,
  code: string,
  correlationId: string,
  message?: string
): NextResponse {
  return NextResponse.json(
    { error: code, message: message || code, requestId: correlationId },
    { status, headers: { ...PRIVATE_HEADERS, 'X-Request-Id': correlationId } }
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const correlationId = requestId(request);
  try {
    const { id } = await params;
    if (!id) return errorResponse(400, 'PIPELINE_ID_REQUIRED', correlationId);

    const ctx = await requireRole('viewer');
    const supabase = getSupabaseAdminClient();

    const { data: pipeline, error } = await supabase
      .from('pipelines')
      .select('*, pipeline_stages(*)')
      .eq('id', id)
      .eq('account_id', ctx.accountId)
      .maybeSingle();

    if (error || !pipeline) {
      return errorResponse(404, 'PIPELINE_NOT_FOUND', correlationId);
    }

    return NextResponse.json(
      { data: pipeline, requestId: correlationId },
      { headers: { ...PRIVATE_HEADERS, 'X-Request-Id': correlationId } }
    );
  } catch (err: unknown) {
    if (err instanceof UnauthorizedError) {
      return errorResponse(401, 'AUTH_REQUIRED', correlationId);
    }
    if (err instanceof ForbiddenError) {
      return errorResponse(403, 'ACCOUNT_MEMBERSHIP_REQUIRED', correlationId);
    }
    return errorResponse(500, 'PIPELINE_FETCH_FAILED', correlationId);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const correlationId = requestId(request);
  try {
    const { id } = await params;
    if (!id) return errorResponse(400, 'PIPELINE_ID_REQUIRED', correlationId);

    const ctx = await requireRole('admin');
    const supabase = getSupabaseAdminClient();
    const body = await request.json();

    const { name, is_default } = body;
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (name !== undefined) {
      if (!String(name).trim())
        return errorResponse(400, 'NAME_REQUIRED', correlationId);
      updates.name = String(name).trim();
    }

    if (is_default) {
      await supabase
        .from('pipelines')
        .update({ is_default: false })
        .eq('account_id', ctx.accountId);
      updates.is_default = true;
    }

    const { data: updatedPipeline, error: updateErr } = await supabase
      .from('pipelines')
      .update(updates)
      .eq('id', id)
      .eq('account_id', ctx.accountId)
      .select('*, pipeline_stages(*)')
      .single();

    if (updateErr || !updatedPipeline) {
      return errorResponse(
        500,
        'PIPELINE_UPDATE_FAILED',
        correlationId,
        updateErr?.message
      );
    }

    return NextResponse.json(
      { data: updatedPipeline, requestId: correlationId },
      { headers: { ...PRIVATE_HEADERS, 'X-Request-Id': correlationId } }
    );
  } catch (err: unknown) {
    if (err instanceof UnauthorizedError) {
      return errorResponse(401, 'AUTH_REQUIRED', correlationId);
    }
    if (err instanceof ForbiddenError) {
      return errorResponse(403, 'ADMIN_PERMISSION_REQUIRED', correlationId);
    }
    return errorResponse(500, 'PIPELINE_UPDATE_FAILED', correlationId);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const correlationId = requestId(request);
  try {
    const { id } = await params;
    if (!id) return errorResponse(400, 'PIPELINE_ID_REQUIRED', correlationId);

    const ctx = await requireRole('admin');
    const supabase = getSupabaseAdminClient();

    // Verify there is at least one other pipeline
    const { count } = await supabase
      .from('pipelines')
      .select('id', { count: 'exact', head: true })
      .eq('account_id', ctx.accountId);

    if (count !== null && count <= 1) {
      return errorResponse(
        400,
        'CANNOT_DELETE_LAST_PIPELINE',
        correlationId,
        'You cannot delete the only pipeline.'
      );
    }

    const { error: delErr } = await supabase
      .from('pipelines')
      .delete()
      .eq('id', id)
      .eq('account_id', ctx.accountId);

    if (delErr) {
      return errorResponse(
        500,
        'PIPELINE_DELETE_FAILED',
        correlationId,
        delErr.message
      );
    }

    return NextResponse.json(
      { success: true, message: 'Pipeline deleted', requestId: correlationId },
      { headers: { ...PRIVATE_HEADERS, 'X-Request-Id': correlationId } }
    );
  } catch (err: unknown) {
    if (err instanceof UnauthorizedError) {
      return errorResponse(401, 'AUTH_REQUIRED', correlationId);
    }
    if (err instanceof ForbiddenError) {
      return errorResponse(403, 'ADMIN_PERMISSION_REQUIRED', correlationId);
    }
    return errorResponse(500, 'PIPELINE_DELETE_FAILED', correlationId);
  }
}
