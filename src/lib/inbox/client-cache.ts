import type { Message } from '@/types';

const OPTIMISTIC_ID_PREFIX = 'temp-';
const RECONCILE_WINDOW_MS = 2 * 60 * 1000;

function timestamp(value: string | undefined): number {
  const parsed = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

function isSameOutgoingMessage(a: Message, b: Message): boolean {
  if (a.sender_type === 'customer' || b.sender_type === 'customer')
    return false;
  if (a.conversation_id !== b.conversation_id) return false;
  if (a.content_type !== b.content_type) return false;
  if ((a.content_text ?? '') !== (b.content_text ?? '')) return false;
  if ((a.media_url ?? '') !== (b.media_url ?? '')) return false;
  if ((a.reply_to_message_id ?? '') !== (b.reply_to_message_id ?? '')) {
    return false;
  }

  return (
    Math.abs(timestamp(a.created_at) - timestamp(b.created_at)) <=
    RECONCILE_WINDOW_MS
  );
}

/**
 * Applies a server snapshot without hiding local optimistic/failed bubbles.
 * Once the server contains an equivalent outgoing row, the temporary bubble
 * is removed so realtime, polling, and the send response cannot duplicate it.
 */
export function mergeMessageSnapshots(
  serverMessages: Message[],
  localMessages: Message[]
): Message[] {
  const merged = [...serverMessages];
  const serverIds = new Set(serverMessages.map((message) => message.id));

  for (const local of localMessages) {
    if (serverIds.has(local.id)) continue;

    const isOptimistic = local.id.startsWith(OPTIMISTIC_ID_PREFIX);
    if (
      !isOptimistic &&
      local.status !== 'sending' &&
      local.status !== 'failed'
    ) {
      continue;
    }

    if (
      serverMessages.some((server) => isSameOutgoingMessage(server, local))
    ) {
      continue;
    }

    merged.push(local);
  }

  return merged.sort(
    (a, b) => timestamp(a.created_at) - timestamp(b.created_at)
  );
}
