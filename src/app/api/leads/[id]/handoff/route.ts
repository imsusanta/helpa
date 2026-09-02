import { NextResponse } from 'next/server';
import { TrustedActionExecutor } from '@/core/actions/action-executor';
import { pauseFollowupsForConversation } from '@/lib/leads/lead-followup.service';
import { getAdminClient } from '@/lib/db/server';
import {
  ForbiddenError,
  requireRole,
  toErrorResponse,
  UnauthorizedError,
} from '@/lib/auth/account';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireRole('agent');
    const { id: leadId } = await params;
    if (!leadId) {
      return NextResponse.json(
        { success: false, error: 'Lead ID is required.' },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const requestedConversationId =
      typeof body.conversationId === 'string' && body.conversationId.length > 0
        ? body.conversationId
        : null;

    const admin = getAdminClient();
    const { data: lead, error: leadErr } = await admin
      .from('leads')
      .select('id, contact_id, conversation_id')
      .eq('id', leadId)
      .eq('account_id', ctx.accountId)
      .maybeSingle();

    if (leadErr || !lead) {
      return NextResponse.json(
        { success: false, error: 'Lead not found.' },
        { status: 404 }
      );
    }

    let conversationId: string | null =
      requestedConversationId || lead.conversation_id || null;

    if (!conversationId && lead.contact_id) {
      const { data: latestConv } = await admin
        .from('conversations')
        .select('id')
        .eq('account_id', ctx.accountId)
        .eq('contact_id', lead.contact_id)
        .order('last_message_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      conversationId = latestConv?.id ?? null;
    }

    if (!conversationId) {
      return NextResponse.json(
        { success: false, error: 'No conversation found for this lead.' },
        { status: 404 }
      );
    }

    const { data: conversation } = await admin
      .from('conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('account_id', ctx.accountId)
      .maybeSingle();

    if (!conversation) {
      return NextResponse.json(
        { success: false, error: 'Conversation not found.' },
        { status: 404 }
      );
    }

    const executor = new TrustedActionExecutor({
      accountId: ctx.accountId,
      actorId: ctx.userId,
      actorType: 'user',
    });

    const result = await executor.handoffToHuman({
      conversationId,
      reason: 'Manual takeover requested from Lead Details drawer',
      leadId,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    try {
      await pauseFollowupsForConversation(getAdminClient(), {
        accountId: ctx.accountId,
        conversationId,
        leadId,
      });
    } catch (err) {
      console.error('[leads] pause follow-ups on handoff failed', err);
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (err: unknown) {
    if (err instanceof UnauthorizedError || err instanceof ForbiddenError) {
      return toErrorResponse(err);
    }
    return NextResponse.json(
      { success: false, error: (err as Error).message || 'Server error' },
      { status: 500 }
    );
  }
}
