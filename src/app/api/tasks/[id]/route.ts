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
    {
      success: false,
      error: code,
      message: message || code,
      requestId: correlationId,
    },
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
    if (!id) return errorResponse(400, 'TASK_ID_REQUIRED', correlationId);

    const ctx = await requireRole('viewer');
    const supabase = getSupabaseAdminClient();

    const { data: task, error } = await supabase
      .from('tasks')
      .select('*, contacts(*), leads(*), deals(*)')
      .eq('id', id)
      .eq('account_id', ctx.accountId)
      .maybeSingle();

    if (error || !task) {
      return errorResponse(
        404,
        'TASK_NOT_FOUND',
        correlationId,
        'Task not found.'
      );
    }

    return NextResponse.json(
      { success: true, data: task, requestId: correlationId },
      { headers: { ...PRIVATE_HEADERS, 'X-Request-Id': correlationId } }
    );
  } catch (err: unknown) {
    if (err instanceof UnauthorizedError) {
      return errorResponse(401, 'AUTH_REQUIRED', correlationId);
    }
    if (err instanceof ForbiddenError) {
      return errorResponse(403, 'ACCOUNT_MEMBERSHIP_REQUIRED', correlationId);
    }
    return errorResponse(500, 'TASK_FETCH_FAILED', correlationId);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const correlationId = requestId(request);
  try {
    const { id } = await params;
    if (!id) return errorResponse(400, 'TASK_ID_REQUIRED', correlationId);

    const ctx = await requireRole('agent');
    const supabase = getSupabaseAdminClient();
    const body = await request.json();

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (body.title !== undefined) updates.title = String(body.title).trim();
    if (body.description !== undefined)
      updates.description = body.description
        ? String(body.description).trim()
        : null;
    if (body.due_at !== undefined)
      updates.due_at = new Date(body.due_at).toISOString();
    if (body.status !== undefined) updates.status = body.status;
    if (body.priority !== undefined) updates.priority = body.priority;
    if (body.assigned_user_id !== undefined)
      updates.assigned_user_id = body.assigned_user_id || null;

    const { data: updatedTask, error: updateError } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', id)
      .eq('account_id', ctx.accountId)
      .select('*, contacts(*), leads(*), deals(*)')
      .single();

    if (updateError || !updatedTask) {
      return errorResponse(
        500,
        'TASK_UPDATE_FAILED',
        correlationId,
        updateError?.message
      );
    }

    return NextResponse.json(
      { success: true, data: updatedTask, requestId: correlationId },
      { headers: { ...PRIVATE_HEADERS, 'X-Request-Id': correlationId } }
    );
  } catch (err: unknown) {
    if (err instanceof UnauthorizedError) {
      return errorResponse(401, 'AUTH_REQUIRED', correlationId);
    }
    if (err instanceof ForbiddenError) {
      return errorResponse(403, 'AGENT_PERMISSION_REQUIRED', correlationId);
    }
    return errorResponse(500, 'TASK_UPDATE_FAILED', correlationId);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const correlationId = requestId(request);
  try {
    const { id } = await params;
    if (!id) return errorResponse(400, 'TASK_ID_REQUIRED', correlationId);

    const ctx = await requireRole('admin');
    const supabase = getSupabaseAdminClient();

    const { error: delErr } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id)
      .eq('account_id', ctx.accountId);

    if (delErr) {
      return errorResponse(
        500,
        'TASK_DELETE_FAILED',
        correlationId,
        delErr.message
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Task deleted successfully',
        requestId: correlationId,
      },
      { headers: { ...PRIVATE_HEADERS, 'X-Request-Id': correlationId } }
    );
  } catch (err: unknown) {
    if (err instanceof UnauthorizedError) {
      return errorResponse(401, 'AUTH_REQUIRED', correlationId);
    }
    if (err instanceof ForbiddenError) {
      return errorResponse(403, 'ADMIN_PERMISSION_REQUIRED', correlationId);
    }
    return errorResponse(500, 'TASK_DELETE_FAILED', correlationId);
  }
}
