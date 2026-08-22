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

export async function GET(request: NextRequest): Promise<NextResponse> {
  const correlationId = requestId(request);
  try {
    const ctx = await requireRole('viewer');
    const supabase = getSupabaseAdminClient();
    const { searchParams } = request.nextUrl;

    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const leadId = searchParams.get('lead_id');
    const contactId = searchParams.get('contact_id');
    const dealId = searchParams.get('deal_id');
    const dueBefore = searchParams.get('due_before');
    const dueAfter = searchParams.get('due_after');

    let query = supabase
      .from('tasks')
      .select(
        '*, contacts(id, name, phone), leads(id, name, stage), deals(id, name, value)'
      )
      .eq('account_id', ctx.accountId);

    if (status && status !== 'all') query = query.eq('status', status);
    if (priority && priority !== 'all') query = query.eq('priority', priority);
    if (leadId) query = query.eq('lead_id', leadId);
    if (contactId) query = query.eq('contact_id', contactId);
    if (dealId) query = query.eq('deal_id', dealId);
    if (dueBefore) query = query.lte('due_at', dueBefore);
    if (dueAfter) query = query.gte('due_at', dueAfter);

    const { data: tasks, error } = await query.order('due_at', {
      ascending: true,
    });

    if (error) {
      return errorResponse(
        500,
        'TASKS_FETCH_FAILED',
        correlationId,
        error.message
      );
    }

    return NextResponse.json(
      { success: true, data: tasks || [], requestId: correlationId },
      { headers: { ...PRIVATE_HEADERS, 'X-Request-Id': correlationId } }
    );
  } catch (err: unknown) {
    if (err instanceof UnauthorizedError) {
      return errorResponse(401, 'AUTH_REQUIRED', correlationId);
    }
    if (err instanceof ForbiddenError) {
      return errorResponse(403, 'ACCOUNT_MEMBERSHIP_REQUIRED', correlationId);
    }
    return errorResponse(500, 'TASKS_FETCH_FAILED', correlationId);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const correlationId = requestId(request);
  try {
    const ctx = await requireRole('agent');
    const supabase = getSupabaseAdminClient();
    const body = await request.json();

    const {
      title,
      description,
      due_at,
      status = 'pending',
      priority = 'medium',
      lead_id,
      contact_id,
      deal_id,
      assigned_user_id,
    } = body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return errorResponse(
        400,
        'TITLE_REQUIRED',
        correlationId,
        'Task title is required.'
      );
    }

    const { data: newTask, error: insertError } = await supabase
      .from('tasks')
      .insert({
        account_id: ctx.accountId,
        title: title.trim(),
        description: description ? String(description).trim() : null,
        due_at: due_at
          ? new Date(due_at).toISOString()
          : new Date().toISOString(),
        status,
        priority,
        lead_id: lead_id || null,
        contact_id: contact_id || null,
        deal_id: deal_id || null,
        assigned_user_id: assigned_user_id || ctx.userId,
        created_by: ctx.userId,
      })
      .select(
        '*, contacts(id, name, phone), leads(id, name, stage), deals(id, name, value)'
      )
      .single();

    if (insertError || !newTask) {
      return errorResponse(
        500,
        'TASK_CREATE_FAILED',
        correlationId,
        insertError?.message
      );
    }

    return NextResponse.json(
      { success: true, data: newTask, requestId: correlationId },
      {
        status: 201,
        headers: { ...PRIVATE_HEADERS, 'X-Request-Id': correlationId },
      }
    );
  } catch (err: unknown) {
    if (err instanceof UnauthorizedError) {
      return errorResponse(401, 'AUTH_REQUIRED', correlationId);
    }
    if (err instanceof ForbiddenError) {
      return errorResponse(403, 'AGENT_PERMISSION_REQUIRED', correlationId);
    }
    return errorResponse(500, 'TASK_CREATE_FAILED', correlationId);
  }
}
