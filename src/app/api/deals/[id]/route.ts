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
    if (!id) return errorResponse(400, 'INVALID_DEAL_ID', correlationId);

    const context = await requireRole('viewer');
    const supabase = getSupabaseAdminClient();

    const { data: deal, error: dealErr } = await supabase
      .from('deals')
      .select('*, contacts(*), pipeline_stages(*), deal_activities(*)')
      .eq('id', id)
      .eq('account_id', context.accountId)
      .maybeSingle();

    if (dealErr || !deal) {
      return errorResponse(404, 'DEAL_NOT_FOUND', correlationId);
    }

    return NextResponse.json(
      { data: deal, requestId: correlationId },
      { headers: { ...PRIVATE_HEADERS, 'X-Request-Id': correlationId } }
    );
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return errorResponse(401, 'AUTH_REQUIRED', correlationId);
    }
    if (error instanceof ForbiddenError) {
      return errorResponse(403, 'ACCOUNT_MEMBERSHIP_REQUIRED', correlationId);
    }
    return errorResponse(500, 'DEAL_FETCH_FAILED', correlationId);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const correlationId = requestId(request);
  try {
    const { id } = await params;
    if (!id) return errorResponse(400, 'INVALID_DEAL_ID', correlationId);

    const context = await requireRole('agent');
    const supabase = getSupabaseAdminClient();
    const body = await request.json();

    // Fetch existing deal for transition detection
    const { data: currentDeal } = await supabase
      .from('deals')
      .select('*')
      .eq('id', id)
      .eq('account_id', context.accountId)
      .single();

    if (!currentDeal) {
      return errorResponse(404, 'DEAL_NOT_FOUND', correlationId);
    }

    const {
      name,
      title,
      value,
      currency,
      probability,
      stage_id,
      status,
      lost_reason,
      reason,
      expected_close_date,
      source,
      notes,
      assigned_user_id,
      assigned_to,
    } = body;

    const effectiveLostReason = lost_reason || reason;
    if (
      status === 'lost' &&
      (!effectiveLostReason || !String(effectiveLostReason).trim()) &&
      !currentDeal.lost_reason
    ) {
      return errorResponse(
        400,
        'LOST_REASON_REQUIRED',
        correlationId,
        'A reason is required when marking a deal as Lost.'
      );
    }

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (name !== undefined || title !== undefined)
      updatePayload.name = String(name || title).trim();
    if (value !== undefined) updatePayload.value = Number(value);
    if (currency !== undefined) updatePayload.currency = String(currency);
    if (probability !== undefined)
      updatePayload.probability = Number(probability);
    if (stage_id !== undefined) updatePayload.stage_id = stage_id;
    if (status !== undefined) updatePayload.status = status;
    if (effectiveLostReason !== undefined)
      updatePayload.lost_reason = effectiveLostReason;
    if (expected_close_date !== undefined)
      updatePayload.expected_close_date = expected_close_date;
    if (source !== undefined) updatePayload.source = source;
    if (notes !== undefined) updatePayload.notes = notes;
    if (assigned_user_id !== undefined || assigned_to !== undefined)
      updatePayload.assigned_user_id = assigned_user_id || assigned_to;

    const { data: updatedDeal, error: updateErr } = await supabase
      .from('deals')
      .update(updatePayload)
      .eq('id', id)
      .eq('account_id', context.accountId)
      .select(
        '*, contacts(id, name, phone, email), pipeline_stages(id, name, color)'
      )
      .single();

    if (updateErr || !updatedDeal) {
      console.error('[deals] Update failed:', updateErr);
      return errorResponse(
        500,
        updateErr ? updateErr.message : 'Update failed',
        correlationId
      );
    }

    // Check for stage change activity
    if (stage_id && stage_id !== currentDeal.stage_id) {
      await supabase.from('deal_activities').insert({
        account_id: context.accountId,
        deal_id: id,
        actor_user_id: context.userId,
        activity_type: 'stage_change',
        title: 'Stage Changed',
        description: `Stage moved from previous stage to new stage`,
        metadata: { from_stage: currentDeal.stage_id, to_stage: stage_id },
      });

      await dispatchCrmEvent({
        accountId: context.accountId,
        eventType: 'deal.stage_changed',
        dealId: id,
        contactId: updatedDeal.contact_id,
        payload: {
          fromStage: currentDeal.stage_id,
          toStage: stage_id,
          deal: updatedDeal,
        },
      });
    }

    // Check for Won / Lost status transitions
    if (status && status !== currentDeal.status) {
      if (status === 'won') {
        await supabase.from('deal_activities').insert({
          account_id: context.accountId,
          deal_id: id,
          actor_user_id: context.userId,
          activity_type: 'won',
          title: 'Deal Won 🎉',
          description: `Deal marked as WON for value ${updatedDeal.currency} ${updatedDeal.value}`,
          metadata: { value: updatedDeal.value },
        });

        await dispatchCrmEvent({
          accountId: context.accountId,
          eventType: 'deal.won',
          dealId: id,
          contactId: updatedDeal.contact_id,
          payload: { deal: updatedDeal },
        });
      } else if (status === 'lost') {
        await supabase.from('deal_activities').insert({
          account_id: context.accountId,
          deal_id: id,
          actor_user_id: context.userId,
          activity_type: 'lost',
          title: 'Deal Lost',
          description: `Deal marked as LOST. Reason: ${lost_reason || 'None specified'}`,
          metadata: { lost_reason },
        });

        await dispatchCrmEvent({
          accountId: context.accountId,
          eventType: 'deal.lost',
          dealId: id,
          contactId: updatedDeal.contact_id,
          payload: { lost_reason, deal: updatedDeal },
        });
      }
    }

    return NextResponse.json(
      { data: updatedDeal, requestId: correlationId },
      { headers: { ...PRIVATE_HEADERS, 'X-Request-Id': correlationId } }
    );
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return errorResponse(401, 'AUTH_REQUIRED', correlationId);
    }
    if (error instanceof ForbiddenError) {
      return errorResponse(403, 'ACCOUNT_MEMBERSHIP_REQUIRED', correlationId);
    }
    return errorResponse(500, 'DEAL_UPDATE_FAILED', correlationId);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const correlationId = requestId(request);
  try {
    const { id } = await params;
    if (!id) return errorResponse(400, 'INVALID_DEAL_ID', correlationId);

    const context = await requireRole('admin');
    const supabase = getSupabaseAdminClient();

    const { error: delErr } = await supabase
      .from('deals')
      .delete()
      .eq('id', id)
      .eq('account_id', context.accountId);

    if (delErr) {
      console.error('[deals] Delete failed:', delErr);
      return errorResponse(500, delErr.message, correlationId);
    }

    return NextResponse.json(
      { success: true, requestId: correlationId },
      { headers: { ...PRIVATE_HEADERS, 'X-Request-Id': correlationId } }
    );
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return errorResponse(401, 'AUTH_REQUIRED', correlationId);
    }
    if (error instanceof ForbiddenError) {
      return errorResponse(403, 'ACCOUNT_MEMBERSHIP_REQUIRED', correlationId);
    }
    return errorResponse(500, 'DEAL_DELETE_FAILED', correlationId);
  }
}
