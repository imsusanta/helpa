import type { Conversation, Message } from '@/types';

function timestamp(value?: string): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sameTimestamp(left?: string, right?: string): boolean {
  const leftTimestamp = timestamp(left);
  const rightTimestamp = timestamp(right);
  return leftTimestamp > 0 && leftTimestamp === rightTimestamp;
}

const MESSAGE_STATUS_RANK: Record<Message['status'], number> = {
  sending: 0,
  failed: 0,
  sent: 1,
  delivered: 2,
  read: 3,
};

function sameOptimisticMessage(temp: Message, incoming: Message): boolean {
  return (
    temp.id.startsWith('temp-') &&
    incoming.sender_type !== 'customer' &&
    temp.conversation_id === incoming.conversation_id &&
    temp.sender_type !== 'customer' &&
    temp.content_type === incoming.content_type &&
    (temp.content_text ?? '') === (incoming.content_text ?? '') &&
    (temp.media_url ?? null) === (incoming.media_url ?? null) &&
    (temp.template_name ?? null) === (incoming.template_name ?? null) &&
    (temp.reply_to_message_id ?? null) ===
      (incoming.reply_to_message_id ?? null)
  );
}

function mergeMessage(existing: Message, incoming: Message): Message {
  const existingRank = MESSAGE_STATUS_RANK[existing.status] ?? 0;
  const incomingRank = MESSAGE_STATUS_RANK[incoming.status] ?? 0;

  // Realtime rows can contain a delivery status that a subsequent API
  // response does not yet know about. Keep the most advanced status while
  // filling any fields that were omitted by the realtime payload.
  return {
    ...existing,
    ...incoming,
    status: existingRank >= incomingRank ? existing.status : incoming.status,
    content_text: incoming.content_text || existing.content_text,
    media_url: incoming.media_url || existing.media_url,
    template_name: incoming.template_name || existing.template_name,
    message_id: incoming.message_id || existing.message_id,
    reply_to_message_id:
      incoming.reply_to_message_id || existing.reply_to_message_id,
    interactive_reply_id:
      incoming.interactive_reply_id || existing.interactive_reply_id,
  };
}

/**
 * Merge an API message snapshot into the rows already held by the inbox.
 *
 * API requests and realtime callbacks can complete in either order. Rows
 * missing from the snapshot are intentionally retained so a just-inserted
 * realtime message (or an optimistic outbound bubble) cannot disappear when
 * the request returns a few milliseconds later.
 */
export function mergeMessages(
  current: Message[],
  incoming: Message[]
): Message[] {
  const result = current.slice();

  for (const message of incoming) {
    const existingIndex = result.findIndex((row) => row.id === message.id);
    if (existingIndex >= 0) {
      result[existingIndex] = mergeMessage(result[existingIndex], message);
      continue;
    }

    const optimisticIndex = result.findIndex((row) =>
      sameOptimisticMessage(row, message)
    );
    if (optimisticIndex >= 0) {
      result[optimisticIndex] = {
        ...result[optimisticIndex],
        ...message,
      };
      continue;
    }

    result.push(message);
  }

  return result.sort(
    (a, b) => timestamp(a.created_at) - timestamp(b.created_at)
  );
}

function mergeConversation(
  existing: Conversation | undefined,
  incoming: Conversation
): Conversation {
  if (!existing) return incoming;

  const existingMessageAt = timestamp(existing.last_message_at);
  const incomingMessageAt = timestamp(incoming.last_message_at);
  const existingUpdatedAt = timestamp(existing.updated_at);
  const incomingUpdatedAt = timestamp(incoming.updated_at);
  const preserveExistingPreview =
    existingMessageAt > incomingMessageAt ||
    (!incoming.last_message_text && !!existing.last_message_text);
  const preserveExistingMutable = existingUpdatedAt > incomingUpdatedAt;

  const merged: Conversation = {
    ...existing,
    ...incoming,
    // Contact is a joined relation and is absent from realtime rows. Never
    // throw away a contact we already hydrated.
    contact: incoming.contact ?? existing.contact,
  };

  if (preserveExistingPreview) {
    merged.last_message_text = existing.last_message_text;
    merged.last_message_at = existing.last_message_at;
    // A message event can optimistically advance unread_count before the
    // conversation rollup event arrives. Do not let an older hydrate/list
    // snapshot temporarily move that count backwards.
    merged.unread_count = Math.max(
      existing.unread_count ?? 0,
      incoming.unread_count ?? 0
    );
  }

  if (preserveExistingMutable) {
    return {
      ...merged,
      status: existing.status,
      assigned_agent_id: existing.assigned_agent_id,
      unread_count: existing.unread_count,
      ai_chat_enabled: existing.ai_chat_enabled,
      ai_intent: existing.ai_intent,
      ai_lead_score: existing.ai_lead_score,
      ai_summary: existing.ai_summary,
      ai_sentiment: existing.ai_sentiment,
      ai_handoff_required: existing.ai_handoff_required,
      ai_resolved: existing.ai_resolved,
      ai_faq_category: existing.ai_faq_category,
      updated_at: existing.updated_at,
    };
  }

  return merged;
}

/** Merge a fetched conversation snapshot without losing live rows. */
export function mergeConversations(
  current: Conversation[],
  incoming: Conversation[],
  preserveMissingIds: ReadonlySet<string> = new Set()
): Conversation[] {
  const currentById = new Map(
    current.map((conversation) => [conversation.id, conversation])
  );
  const incomingIds = new Set(incoming.map((conversation) => conversation.id));
  const merged = incoming.map((conversation) =>
    mergeConversation(currentById.get(conversation.id), conversation)
  );

  // A conversation INSERT can arrive while the list request is in flight.
  // Retain that live row until a later request includes it.
  for (const conversation of current) {
    if (
      !incomingIds.has(conversation.id) &&
      preserveMissingIds.has(conversation.id)
    ) {
      merged.push(conversation);
    }
  }

  return merged;
}

/** Merge one realtime conversation payload into the current row. */
export function mergeConversationEvent(
  existing: Conversation | undefined,
  incoming: Conversation
): Conversation {
  return mergeConversation(existing, incoming);
}

/**
 * Apply a message INSERT to a conversation preview without double-counting
 * unread when the database rollup UPDATE happened to arrive first.
 */
export function applyMessageToConversation(
  conversation: Conversation,
  message: Message,
  options: { active: boolean; firstRealtimeInsert: boolean }
): Conversation {
  const currentMessageAt = timestamp(conversation.last_message_at);
  const incomingMessageAt = timestamp(message.created_at);
  const advancesPreview = incomingMessageAt >= currentMessageAt;
  // An equal timestamp only proves the rollup won the race when the preview
  // agrees as well. Providers commonly timestamp messages to the second, so
  // a separate reply in that same second must still increment unread.
  const preview =
    message.content_text ||
    (message.content_type ? `[${message.content_type}]` : '');
  const rollupAlreadyApplied =
    currentMessageAt > incomingMessageAt ||
    (sameTimestamp(conversation.last_message_at, message.created_at) &&
      conversation.last_message_text === preview);

  return {
    ...conversation,
    last_message_text: advancesPreview
      ? preview
      : conversation.last_message_text,
    last_message_at: advancesPreview
      ? message.created_at
      : conversation.last_message_at,
    unread_count: options.active
      ? 0
      : message.sender_type === 'customer' &&
          options.firstRealtimeInsert &&
          !rollupAlreadyApplied
        ? (conversation.unread_count ?? 0) + 1
        : conversation.unread_count,
  };
}
