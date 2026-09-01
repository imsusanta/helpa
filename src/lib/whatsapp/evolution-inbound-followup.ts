import { handleTravelBookingInbound } from '@/lib/travel/booking-confirm';
import { runAutomationsForTrigger } from '@/lib/automations/engine';

export async function dispatchEvolutionInboundFollowup(opts: {
  accountId: string;
  userId: string;
  contactId: string;
  conversationId: string;
  inboundText: string;
  interactiveReplyId?: string | null;
  isFirstInboundMessage?: boolean;
}): Promise<{ handled: boolean }> {
  const travelHandled = await handleTravelBookingInbound({
    accountId: opts.accountId,
    userId: opts.userId,
    contactId: opts.contactId,
    conversationId: opts.conversationId,
    interactiveReplyId: opts.interactiveReplyId,
    inboundText: opts.inboundText,
  });
  if (travelHandled) return { handled: true };

  const triggers: Array<
    'first_inbound_message' | 'new_message_received' | 'keyword_match'
  > = [];
  if (opts.isFirstInboundMessage) {
    triggers.push('first_inbound_message');
  }
  triggers.push('new_message_received', 'keyword_match');

  let replied = false;
  for (const triggerType of triggers) {
    try {
      const autoRes = await runAutomationsForTrigger({
        accountId: opts.accountId,
        triggerType,
        contactId: opts.contactId,
        context: {
          message_text: opts.inboundText,
          conversation_id: opts.conversationId,
        },
      });
      if (autoRes?.replied) replied = true;
    } catch (error) {
      console.error('[evolution webhook] automation dispatch failed:', error);
    }
  }

  return { handled: replied };
}
