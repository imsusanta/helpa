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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const correlationId = requestId(request);
  try {
    const { id } = await params;
    if (!id) return errorResponse(400, 'TASK_ID_REQUIRED', correlationId);

    const ctx = await requireRole('viewer');
    const tasksRepo = getTasksRepository({ accountId: ctx.accountId });
    const task = await tasksRepo.getTaskById(id);

    if (!task) {
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
    console.error('[tasks] GET by id error:', {
      requestId: correlationId,
      error: err,
    });
    return errorResponse(
      500,
      'TASK_FETCH_FAILED',
      correlationId,
      'Unable to load task.'
    );
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
    const body = await request.json();

    const tasksRepo = getTasksRepository({ accountId: ctx.accountId });
    const updatedTask = await tasksRepo.updateTask(id, {
      title: body.title !== undefined ? String(body.title).trim() : undefined,
      description:
        body.description !== undefined
          ? body.description
            ? String(body.description).trim()
            : null
          : undefined,
      due_at:
        body.due_at !== undefined
          ? new Date(body.due_at).toISOString()
          : undefined,
      status: body.status,
      priority: body.priority,
      assigned_user_id: body.assigned_user_id,
    });

    if (!updatedTask) {
      return errorResponse(
        500,
        'TASK_UPDATE_FAILED',
        correlationId,
        'Unable to update task.'
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
    console.error('[tasks] PUT unhandled error:', {
      requestId: correlationId,
      error: err,
    });
    return errorResponse(
      500,
      'TASK_UPDATE_FAILED',
      correlationId,
      'Unable to update task.'
    );
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
    const tasksRepo = getTasksRepository({ accountId: ctx.accountId });
    await tasksRepo.deleteTask(id);

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
    console.error('[tasks] DELETE unhandled error:', {
      requestId: correlationId,
      error: err,
    });
    return errorResponse(
      500,
      'TASK_DELETE_FAILED',
      correlationId,
      'Unable to delete task.'
    );
  }
}
