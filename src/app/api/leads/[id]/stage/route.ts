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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const correlationId = requestId(request);
  try {
    const { id } = await params;
    if (!id) return errorResponse(400, 'INVALID_LEAD_ID', correlationId);

    const ctx = await requireRole('agent');
    const supabase = getSupabaseAdminClient();
    const body = await request.json();

    const { stage, lost_reason, notes, reason } = body;
    if (!stage || typeof stage !== 'string') {
      return errorResponse(
        400,
        'STAGE_REQUIRED',
        correlationId,
        'New stage is required.'
      );
    }

    const normalizedStage = stage.toUpperCase();

    // Fetch existing lead
    const { data: lead, error: fetchErr } = await supabase
      .from('leads')
      .select('*')
      .eq('id', id)
      .eq('account_id', ctx.accountId)
      .maybeSingle();

    if (fetchErr || !lead) {
      return errorResponse(
        404,
        'LEAD_NOT_FOUND',
        correlationId,
        'Lead not found.'
      );
    }

    // If changing to LOST, require lost_reason
    const effectiveLostReason =
      lost_reason ||
      reason ||
      (normalizedStage === 'LOST' ? lead.lost_reason : null);
    if (
      normalizedStage === 'LOST' &&
      (!effectiveLostReason || !String(effectiveLostReason).trim())
    ) {
      return errorResponse(
        400,
        'LOST_REASON_REQUIRED',
        correlationId,
        'A reason is required when marking a lead as Lost.'
      );
    }

    const previousStage = lead.stage;

    const { data: updatedLead, error: updateErr } = await supabase
      .from('leads')
      .update({
        stage: normalizedStage,
        lost_reason:
          normalizedStage === 'LOST' ? effectiveLostReason : lead.lost_reason,
        notes: notes ? String(notes).trim() : lead.notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('account_id', ctx.accountId)
      .select('*, contacts:contact_id(*)')
      .single();

    if (updateErr || !updatedLead) {
      console.error('[leads] stage update error:', {
        requestId: correlationId,
        code: updateErr?.code,
        message: updateErr?.message,
      });
      return errorResponse(
        500,
        'STAGE_UPDATE_FAILED',
        correlationId,
        'Unable to update lead stage.'
      );
    }

    // Record stage history in lead_activities
    await supabase.from('lead_activities').insert({
      account_id: ctx.accountId,
      lead_id: id,
      actor_user_id: ctx.userId,
      activity_type: 'stage_change',
      previous_stage: previousStage,
      next_stage: normalizedStage,
      reason: effectiveLostReason,
      notes: notes || null,
    });

    if (normalizedStage === 'LOST' || normalizedStage === 'CONVERTED') {
      try {
        const { stopFollowupsForLead } =
          await import('@/lib/leads/lead-followup.service');
        await stopFollowupsForLead(supabase, {
          accountId: ctx.accountId,
          leadId: id,
          reason: normalizedStage === 'LOST' ? 'lead_lost' : 'lead_converted',
          correlationId,
        });
      } catch (err) {
        console.error('[leads] stop follow-ups on stage change failed', err);
      }
    }

    // Dispatch CRM Event
    try {
      await dispatchCrmEvent({
        eventType: 'deal.stage_changed',
        accountId: ctx.accountId,
        contactId: lead.contact_id || undefined,
        payload: {
          leadId: lead.id,
          previousStage,
          newStage: normalizedStage,
        },
      });
    } catch (eventErr) {
      console.warn('[leads] Stage change event dispatch failed:', eventErr);
    }

    return NextResponse.json(
      {
        success: true,
        data: updatedLead,
        requestId: correlationId,
      },
      { headers: { ...PRIVATE_HEADERS, 'X-Request-Id': correlationId } }
    );
  } catch (err: unknown) {
    if (err instanceof UnauthorizedError) {
      return errorResponse(401, 'AUTH_REQUIRED', correlationId);
    }
    if (err instanceof ForbiddenError) {
      return errorResponse(403, 'AGENT_PERMISSION_REQUIRED', correlationId);
    }
    console.error('[leads] stage update unhandled error:', {
      requestId: correlationId,
      error: err,
    });
    return errorResponse(
      500,
      'STAGE_UPDATE_FAILED',
      correlationId,
      'Unable to update lead stage.'
    );
  }
}
