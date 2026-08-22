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

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; stageId: string }> }
): Promise<NextResponse> {
  const correlationId = requestId(request);
  try {
    const { id: pipelineId, stageId } = await params;
    if (!pipelineId || !stageId)
      return errorResponse(
        400,
        'STAGE_AND_PIPELINE_ID_REQUIRED',
        correlationId
      );

    const ctx = await requireRole('admin');
    const supabase = getSupabaseAdminClient();
    const body = await request.json();

    const { name, color, order_index, position } = body;
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (name !== undefined) updates.name = String(name).trim();
    if (color !== undefined) updates.color = String(color);
    if (order_index !== undefined) updates.order_index = Number(order_index);
    else if (position !== undefined) updates.order_index = Number(position);

    const { data: updatedStage, error } = await supabase
      .from('pipeline_stages')
      .update(updates)
      .eq('id', stageId)
      .eq('pipeline_id', pipelineId)
      .eq('account_id', ctx.accountId)
      .select()
      .single();

    if (error || !updatedStage) {
      return errorResponse(
        500,
        'STAGE_UPDATE_FAILED',
        correlationId,
        error?.message
      );
    }

    return NextResponse.json(
      { data: updatedStage, requestId: correlationId },
      { headers: { ...PRIVATE_HEADERS, 'X-Request-Id': correlationId } }
    );
  } catch (err: unknown) {
    if (err instanceof UnauthorizedError) {
      return errorResponse(401, 'AUTH_REQUIRED', correlationId);
    }
    if (err instanceof ForbiddenError) {
      return errorResponse(403, 'ADMIN_PERMISSION_REQUIRED', correlationId);
    }
    return errorResponse(500, 'STAGE_UPDATE_FAILED', correlationId);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; stageId: string }> }
): Promise<NextResponse> {
  const correlationId = requestId(request);
  try {
    const { id: pipelineId, stageId } = await params;
    if (!pipelineId || !stageId)
      return errorResponse(
        400,
        'STAGE_AND_PIPELINE_ID_REQUIRED',
        correlationId
      );

    const ctx = await requireRole('admin');
    const supabase = getSupabaseAdminClient();

    const { error } = await supabase
      .from('pipeline_stages')
      .delete()
      .eq('id', stageId)
      .eq('pipeline_id', pipelineId)
      .eq('account_id', ctx.accountId);

    if (error) {
      return errorResponse(
        500,
        'STAGE_DELETE_FAILED',
        correlationId,
        error.message
      );
    }

    return NextResponse.json(
      { success: true, message: 'Stage deleted', requestId: correlationId },
      { headers: { ...PRIVATE_HEADERS, 'X-Request-Id': correlationId } }
    );
  } catch (err: unknown) {
    if (err instanceof UnauthorizedError) {
      return errorResponse(401, 'AUTH_REQUIRED', correlationId);
    }
    if (err instanceof ForbiddenError) {
      return errorResponse(403, 'ADMIN_PERMISSION_REQUIRED', correlationId);
    }
    return errorResponse(500, 'STAGE_DELETE_FAILED', correlationId);
  }
}
