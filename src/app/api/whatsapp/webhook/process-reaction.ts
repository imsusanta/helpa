import { getAdminClient } from '@/lib/appwrite-compat';
import { lookupInternalIdByMetaId } from './conversation-service';
import type { WhatsAppMessage } from './types';

/**
 * Persist an inbound reaction. WhatsApp reactions are not new messages —
 * they're per-(target, actor) state upserted into message_reactions.
 */
export async function handleReaction(
  message: WhatsAppMessage,
  conversationId: string,
  contactId: string
) {
  const reaction = message.reaction;
  if (!reaction?.message_id) return;

  const targetInternalId = await lookupInternalIdByMetaId(
    reaction.message_id,
    conversationId
  );
  if (!targetInternalId) {
    console.warn(
      '[webhook] reaction target message not found; skipping',
      reaction.message_id
    );
    return;
  }

  // Empty emoji = removal
  if (!reaction.emoji) {
    const { error: delError } = await getAdminClient()
      .from('message_reactions')
      .delete()
      .eq('message_id', targetInternalId)
      .eq('actor_type', 'customer')
      .eq('actor_id', contactId);
    if (delError) {
      console.error('[webhook] reaction delete failed:', delError.message);
    }
    return;
  }

  const { error: upsertError } = await getAdminClient()
    .from('message_reactions')
    .upsert(
      {
        message_id: targetInternalId,
        conversation_id: conversationId,
        actor_type: 'customer',
        actor_id: contactId,
        emoji: reaction.emoji,
      },
      { onConflict: 'message_id,actor_type,actor_id' }
    );
  if (upsertError) {
    console.error('[webhook] reaction upsert failed:', upsertError.message);
  }
}
