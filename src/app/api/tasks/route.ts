import { NextRequest, NextResponse } from 'next/server';
import {
  ForbiddenError,
  UnauthorizedError,
  requireRole,
} from '@/lib/auth/account';
import { getTasksRepository } from '@/core/repositories/tasks';

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
    const { searchParams } = request.nextUrl;

    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const leadId = searchParams.get('lead_id');
    const contactId = searchParams.get('contact_id');
    const dealId = searchParams.get('deal_id');
    const dueBefore = searchParams.get('due_before');
    const dueAfter = searchParams.get('due_after');

    const tasksRepo = getTasksRepository({ accountId: ctx.accountId });
    const tasks = await tasksRepo.listTasks({
      status: status || undefined,
      priority: priority || undefined,
      leadId: leadId || undefined,
      contactId: contactId || undefined,
      dealId: dealId || undefined,
      dueBefore: dueBefore || undefined,
      dueAfter: dueAfter || undefined,
    });

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
    console.error('[tasks] GET unhandled error:', {
      requestId: correlationId,
      error: err,
    });
    return errorResponse(
      500,
      'TASKS_FETCH_FAILED',
      correlationId,
      'Unable to load tasks.'
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const correlationId = requestId(request);
  try {
    const ctx = await requireRole('agent');
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

    const tasksRepo = getTasksRepository({ accountId: ctx.accountId });
    const newTask = await tasksRepo.createTask({
      title: title.trim(),
      description: description ? String(description).trim() : null,
      due_at,
      status,
      priority,
      lead_id: lead_id || null,
      contact_id: contact_id || null,
      deal_id: deal_id || null,
      assigned_user_id: assigned_user_id || ctx.userId,
      created_by: ctx.userId,
    });

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
    console.error('[tasks] POST unhandled error:', {
      requestId: correlationId,
      error: err,
    });
    return errorResponse(
      500,
      'TASK_CREATE_FAILED',
      correlationId,
      'Unable to create task.'
    );
  }
}
