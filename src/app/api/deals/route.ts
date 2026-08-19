import { NextRequest, NextResponse } from 'next/server';
import {
  ForbiddenError,
  UnauthorizedError,
  requireRole,
} from '@/lib/auth/account';
import { getAdminClient as getSupabaseAdminClient } from '@/lib/supabase/server';
import { dispatchCrmEvent } from '@/core/events';

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

export async function GET(request: NextRequest): Promise<NextResponse> {
  const correlationId = requestId(request);
  try {
    const context = await requireRole('viewer');
    const supabase = getSupabaseAdminClient();

    const pipelineId = request.nextUrl.searchParams.get('pipeline_id');
    const stageId = request.nextUrl.searchParams.get('stage_id');
    const contactId = request.nextUrl.searchParams.get('contact_id');
    const status = request.nextUrl.searchParams.get('status');

    let query = supabase
      .from('deals')
      .select(
        '*, contacts(id, name, phone, email), pipeline_stages(id, name, color)'
      )
      .eq('account_id', context.accountId);

    if (pipelineId) query = query.eq('pipeline_id', pipelineId);
    if (stageId) query = query.eq('stage_id', stageId);
    if (contactId) query = query.eq('contact_id', contactId);
    if (status) query = query.eq('status', status);

    const { data: deals, error } = await query.order('created_at', {
      ascending: false,
    });

    if (error) {
      console.error('[deals] Query failed:', error);
      return errorResponse(500, error.message, correlationId);
    }

    return NextResponse.json(
      { data: deals || [], requestId: correlationId },
      { headers: { ...PRIVATE_HEADERS, 'X-Request-Id': correlationId } }
    );
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return errorResponse(401, 'AUTH_REQUIRED', correlationId);
    }
    if (error instanceof ForbiddenError) {
      return errorResponse(403, 'ACCOUNT_MEMBERSHIP_REQUIRED', correlationId);
    }
    return errorResponse(500, 'DEALS_FETCH_FAILED', correlationId);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const correlationId = requestId(request);
  try {
    const context = await requireRole('agent');
    const supabase = getSupabaseAdminClient();
    const body = await request.json();

    const {
      pipeline_id,
      stage_id,
      contact_id,
      name,
      value = 0,
      currency = 'USD',
      probability = 50,
      expected_close_date,
      source,
      notes,
    } = body;

    if (!pipeline_id || !stage_id || !name || !String(name).trim()) {
      return errorResponse(
        400,
        'NAME_PIPELINE_AND_STAGE_REQUIRED',
        correlationId
      );
    }

    const { data: newDeal, error: insertErr } = await supabase
      .from('deals')
      .insert({
        account_id: context.accountId,
        pipeline_id,
        stage_id,
        contact_id: contact_id || null,
        assigned_user_id: context.userId,
        name: String(name).trim(),
        value: Number(value) || 0,
        currency: currency || 'USD',
        probability: Number(probability) || 50,
        expected_close_date: expected_close_date || null,
        source: source || null,
        notes: notes || null,
        status: 'open',
      })
      .select(
        '*, contacts(id, name, phone, email), pipeline_stages(id, name, color)'
      )
      .single();

    if (insertErr || !newDeal) {
      console.error('[deals] Insert failed:', insertErr);
      return errorResponse(
        500,
        insertErr ? insertErr.message : 'Insert failed',
        correlationId
      );
    }

    // Log Activity
    await supabase.from('deal_activities').insert({
      account_id: context.accountId,
      deal_id: newDeal.id,
      actor_user_id: context.userId,
      activity_type: 'created',
      title: 'Deal Created',
      description: `Deal "${newDeal.name}" created with value ${newDeal.currency} ${newDeal.value}`,
      metadata: { initial_stage: stage_id, value },
    });

    // Central CRM Event Dispatch
    try {
      await dispatchCrmEvent({
        accountId: context.accountId,
        eventType: 'deal.created',
        dealId: newDeal.id,
        contactId: contact_id,
        payload: newDeal,
      });
    } catch (err) {
      console.warn('[CRM Event] Dispatch warning:', err);
    }

    return NextResponse.json(
      { data: newDeal, requestId: correlationId },
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
    return errorResponse(500, 'DEAL_CREATE_FAILED', correlationId);
  }
}
