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
      return errorResponse(
        404,
        'DEAL_NOT_FOUND',
        correlationId,
        'Deal not found.'
      );
    }

    return NextResponse.json(
      { success: true, data: deal, requestId: correlationId },
      { headers: { ...PRIVATE_HEADERS, 'X-Request-Id': correlationId } }
    );
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return errorResponse(401, 'AUTH_REQUIRED', correlationId);
    }
    if (error instanceof ForbiddenError) {
      return errorResponse(403, 'ACCOUNT_MEMBERSHIP_REQUIRED', correlationId);
    }
    console.error('[deals] GET by ID error:', {
      requestId: correlationId,
      error,
    });
    return errorResponse(
      500,
      'DEAL_FETCH_FAILED',
      correlationId,
      'Unable to load deal.'
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
      return errorResponse(
        404,
        'DEAL_NOT_FOUND',
        correlationId,
        'Deal not found.'
      );
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
      console.error('[deals] Update failed:', {
        requestId: correlationId,
        code: updateErr?.code,
        message: updateErr?.message,
      });
      return errorResponse(
        500,
        'DEAL_UPDATE_FAILED',
        correlationId,
        'Unable to update deal.'
      );
    }

    // Handle Stage or Status Change Activity Logs
    if (stage_id && stage_id !== currentDeal.stage_id) {
      await supabase.from('deal_activities').insert({
        account_id: context.accountId,
        deal_id: id,
        actor_user_id: context.userId,
        activity_type: 'stage_change',
        title: 'Stage Changed',
        description: `Deal moved to new stage`,
        metadata: {
          previous_stage_id: currentDeal.stage_id,
          new_stage_id: stage_id,
        },
      });

      await dispatchCrmEvent({
        accountId: context.accountId,
        eventType: 'deal.stage_changed',
        dealId: id,
        contactId: updatedDeal.contact_id,
        payload: {
          previousStageId: currentDeal.stage_id,
          newStageId: stage_id,
          deal: updatedDeal,
        },
      });
    }

    if (status && status !== currentDeal.status) {
      if (status === 'won') {
        await supabase.from('deal_activities').insert({
          account_id: context.accountId,
          deal_id: id,
          actor_user_id: context.userId,
          activity_type: 'won',
          title: 'Deal Won',
          description: `Deal marked as WON with value ${updatedDeal.currency} ${updatedDeal.value}`,
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
          description: `Deal marked as LOST. Reason: ${effectiveLostReason || 'None specified'}`,
          metadata: { lost_reason: effectiveLostReason },
        });

        await dispatchCrmEvent({
          accountId: context.accountId,
          eventType: 'deal.lost',
          dealId: id,
          contactId: updatedDeal.contact_id,
          payload: { lost_reason: effectiveLostReason, deal: updatedDeal },
        });
      }
    }

    return NextResponse.json(
      { success: true, data: updatedDeal, requestId: correlationId },
      { headers: { ...PRIVATE_HEADERS, 'X-Request-Id': correlationId } }
    );
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return errorResponse(401, 'AUTH_REQUIRED', correlationId);
    }
    if (error instanceof ForbiddenError) {
      return errorResponse(403, 'ACCOUNT_MEMBERSHIP_REQUIRED', correlationId);
    }
    console.error('[deals] PUT error:', {
      requestId: correlationId,
      error,
    });
    return errorResponse(
      500,
      'DEAL_UPDATE_FAILED',
      correlationId,
      'Unable to update deal.'
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
    if (!id) return errorResponse(400, 'INVALID_DEAL_ID', correlationId);

    const context = await requireRole('admin');
    const supabase = getSupabaseAdminClient();

    const { error: delErr } = await supabase
      .from('deals')
      .delete()
      .eq('id', id)
      .eq('account_id', context.accountId);

    if (delErr) {
      console.error('[deals] Delete failed:', {
        requestId: correlationId,
        code: delErr.code,
        message: delErr.message,
      });
      return errorResponse(
        500,
        'DEAL_DELETE_FAILED',
        correlationId,
        'Unable to delete deal.'
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Deal deleted successfully',
        requestId: correlationId,
      },
      { headers: { ...PRIVATE_HEADERS, 'X-Request-Id': correlationId } }
    );
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return errorResponse(401, 'AUTH_REQUIRED', correlationId);
    }
    if (error instanceof ForbiddenError) {
      return errorResponse(403, 'ACCOUNT_MEMBERSHIP_REQUIRED', correlationId);
    }
    console.error('[deals] DELETE error:', {
      requestId: correlationId,
      error,
    });
    return errorResponse(
      500,
      'DEAL_DELETE_FAILED',
      correlationId,
      'Unable to delete deal.'
    );
  }
}
