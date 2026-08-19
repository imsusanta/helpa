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
  correlationId: string
): NextResponse {
  return NextResponse.json(
    { error: code, requestId: correlationId },
    { status, headers: { ...PRIVATE_HEADERS, 'X-Request-Id': correlationId } }
  );
}

const DEFAULT_STAGES = [
  { name: 'New Lead', color: '#3b82f6', order_index: 0 },
  { name: 'Contacted', color: '#f59e0b', order_index: 1 },
  { name: 'Qualified', color: '#8b5cf6', order_index: 2 },
  { name: 'Proposal', color: '#6366f1', order_index: 3 },
  { name: 'Negotiation', color: '#ec4899', order_index: 4 },
  { name: 'Won', color: '#10b981', order_index: 5 },
  { name: 'Lost', color: '#ef4444', order_index: 6 },
];

export async function GET(request: NextRequest): Promise<NextResponse> {
  const correlationId = requestId(request);
  try {
    const context = await requireRole('viewer');
    const supabase = getSupabaseAdminClient();

    const { data: initialPipelines, error } = await supabase
      .from('pipelines')
      .select('*, pipeline_stages(*)')
      .eq('account_id', context.accountId)
      .order('created_at', { ascending: true });

    let pipelines = initialPipelines;

    if (error) {
      console.error('[pipelines] Query failed:', error);
      return errorResponse(500, error.message, correlationId);
    }

    // Auto-seed default pipeline if none exists for this tenant
    if (!pipelines || pipelines.length === 0) {
      const { data: newPipeline } = await supabase
        .from('pipelines')
        .insert({
          account_id: context.accountId,
          name: 'Sales Pipeline',
          is_default: true,
        })
        .select()
        .single();

      if (newPipeline) {
        const stageRows = DEFAULT_STAGES.map((s) => ({
          account_id: context.accountId,
          pipeline_id: newPipeline.id,
          name: s.name,
          color: s.color,
          order_index: s.order_index,
        }));
        await supabase.from('pipeline_stages').insert(stageRows);

        const { data: seeded } = await supabase
          .from('pipelines')
          .select('*, pipeline_stages(*)')
          .eq('id', newPipeline.id)
          .single();

        pipelines = seeded ? [seeded] : [];
      }
    }

    return NextResponse.json(
      { data: pipelines || [], requestId: correlationId },
      { headers: { ...PRIVATE_HEADERS, 'X-Request-Id': correlationId } }
    );
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return errorResponse(401, 'AUTH_REQUIRED', correlationId);
    }
    if (error instanceof ForbiddenError) {
      return errorResponse(403, 'ACCOUNT_MEMBERSHIP_REQUIRED', correlationId);
    }
    return errorResponse(500, 'PIPELINES_FETCH_FAILED', correlationId);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const correlationId = requestId(request);
  try {
    const context = await requireRole('admin');
    const supabase = getSupabaseAdminClient();
    const body = await request.json();

    const { name, is_default, stages } = body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return errorResponse(400, 'NAME_REQUIRED', correlationId);
    }

    // If setting as default, unset other defaults
    if (is_default) {
      await supabase
        .from('pipelines')
        .update({ is_default: false })
        .eq('account_id', context.accountId);
    }

    const { data: newPipeline, error: insertErr } = await supabase
      .from('pipelines')
      .insert({
        account_id: context.accountId,
        name: name.trim(),
        is_default: Boolean(is_default),
      })
      .select()
      .single();

    if (insertErr || !newPipeline) {
      console.error('[pipelines] Create failed:', insertErr);
      return errorResponse(
        500,
        insertErr ? insertErr.message : 'Create failed',
        correlationId
      );
    }

    const stagesToInsert =
      Array.isArray(stages) && stages.length > 0
        ? stages.map(
            (
              s: { name: string; color?: string; order_index?: number },
              idx: number
            ) => ({
              account_id: context.accountId,
              pipeline_id: newPipeline.id,
              name: s.name,
              color: s.color || '#64748b',
              order_index: s.order_index ?? idx,
            })
          )
        : DEFAULT_STAGES.map((s) => ({
            account_id: context.accountId,
            pipeline_id: newPipeline.id,
            name: s.name,
            color: s.color,
            order_index: s.order_index,
          }));

    await supabase.from('pipeline_stages').insert(stagesToInsert);

    const { data: fullPipeline } = await supabase
      .from('pipelines')
      .select('*, pipeline_stages(*)')
      .eq('id', newPipeline.id)
      .single();

    return NextResponse.json(
      { data: fullPipeline, requestId: correlationId },
      {
        status: 201,
        headers: { ...PRIVATE_HEADERS, 'X-Request-Id': correlationId },
      }
    );
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return errorResponse(401, 'AUTH_REQUIRED', correlationId);
    }
    if (error instanceof ForbiddenError) {
      return errorResponse(403, 'ACCOUNT_MEMBERSHIP_REQUIRED', correlationId);
    }
    return errorResponse(500, 'PIPELINE_CREATE_FAILED', correlationId);
  }
}
