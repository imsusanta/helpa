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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const correlationId = requestId(request);
  try {
    const { id: pipelineId } = await params;
    if (!pipelineId)
      return errorResponse(400, 'PIPELINE_ID_REQUIRED', correlationId);

    const ctx = await requireRole('admin');
    const supabase = getSupabaseAdminClient();
    const body = await request.json();

    const { name, color = '#64748b', order_index, position } = body;
    if (!name || !String(name).trim()) {
      return errorResponse(
        400,
        'STAGE_NAME_REQUIRED',
        correlationId,
        'Stage name is required.'
      );
    }

    const { data: newStage, error } = await supabase
      .from('pipeline_stages')
      .insert({
        account_id: ctx.accountId,
        pipeline_id: pipelineId,
        name: String(name).trim(),
        color: String(color),
        order_index:
          order_index !== undefined
            ? Number(order_index)
            : position !== undefined
              ? Number(position)
              : 0,
      })
      .select()
      .single();

    if (error || !newStage) {
      console.error('[pipeline_stages] POST error:', {
        requestId: correlationId,
        code: error?.code,
        message: error?.message,
      });
      return errorResponse(
        500,
        'STAGE_CREATE_FAILED',
        correlationId,
        'Unable to create pipeline stage.'
      );
    }

    return NextResponse.json(
      { data: newStage, requestId: correlationId },
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
      return errorResponse(403, 'ADMIN_PERMISSION_REQUIRED', correlationId);
    }
    console.error('[pipeline_stages] POST unhandled error:', {
      requestId: correlationId,
      error: err,
    });
    return errorResponse(
      500,
      'STAGE_CREATE_FAILED',
      correlationId,
      'Unable to create pipeline stage.'
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const correlationId = requestId(request);
  try {
    const { id: pipelineId } = await params;
    if (!pipelineId)
      return errorResponse(400, 'PIPELINE_ID_REQUIRED', correlationId);

    const ctx = await requireRole('admin');
    const supabase = getSupabaseAdminClient();
    const body = await request.json();

    const { stages } = body;
    if (!Array.isArray(stages)) {
      return errorResponse(
        400,
        'STAGES_ARRAY_REQUIRED',
        correlationId,
        'Stages must be an array.'
      );
    }

    // Batch update stage order indices
    for (const s of stages) {
      if (s.id) {
        await supabase
          .from('pipeline_stages')
          .update({
            order_index: s.order_index ?? s.position ?? 0,
            updated_at: new Date().toISOString(),
          })
          .eq('id', s.id)
          .eq('pipeline_id', pipelineId)
          .eq('account_id', ctx.accountId);
      }
    }

    const { data: updatedStages } = await supabase
      .from('pipeline_stages')
      .select('*')
      .eq('pipeline_id', pipelineId)
      .eq('account_id', ctx.accountId)
      .order('order_index', { ascending: true });

    return NextResponse.json(
      { data: updatedStages || [], requestId: correlationId },
      { headers: { ...PRIVATE_HEADERS, 'X-Request-Id': correlationId } }
    );
  } catch (err: unknown) {
    if (err instanceof UnauthorizedError) {
      return errorResponse(401, 'AUTH_REQUIRED', correlationId);
    }
    if (err instanceof ForbiddenError) {
      return errorResponse(403, 'ADMIN_PERMISSION_REQUIRED', correlationId);
    }
    console.error('[pipeline_stages] PUT unhandled error:', {
      requestId: correlationId,
      error: err,
    });
    return errorResponse(
      500,
      'STAGES_UPDATE_FAILED',
      correlationId,
      'Unable to update pipeline stages.'
    );
  }
}
