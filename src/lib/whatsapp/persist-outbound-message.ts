import { getAdminClient } from '@/lib/db/server';

export interface PersistOutboundMessageInput {
  accountId: string;
  conversationId: string;
  senderId?: string | null;
  contentType: string;
  contentText: string | null;
  mediaUrl?: string | null;
  templateName?: string | null;
  providerMessageId: string;
  replyToMessageId?: string | null;
}

export type PersistOutboundMessageResult =
  | { ok: true; messageId: string; duplicate: boolean }
  | { ok: false; error: string };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(value?: string | null): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

function errorMessage(error: unknown): string {
  if (!error) return 'Unknown error';
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message) return message;
  }
  return String(error);
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: string | number; message?: string };
  return (
    candidate.code === '23505' ||
    candidate.code === 23505 ||
    /duplicate key|already exists|unique constraint/i.test(
      candidate.message || ''
    )
  );
}

async function lookupExistingMessage(
  accountId: string,
  providerMessageId: string
): Promise<{ id: string } | null> {
  const db = getAdminClient();
  const attempts: Array<{ account?: string; id: string }> = [
    { account: 'account_id', id: 'provider_message_id' },
    { account: 'account_id', id: 'message_id' },
    { id: 'provider_message_id' },
    { id: 'message_id' },
  ];

  for (const attempt of attempts) {
    try {
      const query = attempt.account
        ? db
            .from('messages')
            .select('id')
            .eq(attempt.account, accountId)
            .eq(attempt.id, providerMessageId)
        : db.from('messages').select('id').eq(attempt.id, providerMessageId);
      const { data } = await query.maybeSingle();
      if (data?.id) return { id: String(data.id) };
    } catch {
      // Column may not exist on this schema; try the next lookup.
    }
  }

  return null;
}

/**
 * Persist a Meta-accepted outbound WhatsApp message into `messages`.
 *
 * The inbox thread and conversation list both read this table. Sending to
 * Meta without writing a local row is how outbound bubbles disappear after
 * refresh: WhatsApp delivers the message, but `/inbox` has nothing to show.
 */
export async function persistOutboundMessage(
  input: PersistOutboundMessageInput
): Promise<PersistOutboundMessageResult> {
  const db = getAdminClient();
  const now = new Date().toISOString();
  const existing = await lookupExistingMessage(
    input.accountId,
    input.providerMessageId
  );
  if (existing) {
    return { ok: true, messageId: existing.id, duplicate: true };
  }

  const replyToId = isValidUuid(input.replyToMessageId)
    ? input.replyToMessageId
    : null;
  const senderId = isValidUuid(input.senderId) ? input.senderId : undefined;

  const canonical: Record<string, unknown> = {
    account_id: input.accountId,
    conversation_id: input.conversationId,
    direction: 'outbound',
    provider_message_id: input.providerMessageId,
    sender_type: 'agent',
    content_type: input.contentType || 'text',
    content_text: input.contentText,
    media_url: input.mediaUrl || null,
    template_name: input.templateName || null,
    message_id: input.providerMessageId,
    status: 'sent',
    created_at: now,
    updated_at: now,
  };
  if (replyToId) canonical.reply_to_message_id = replyToId;
  if (senderId) canonical.sender_id = senderId;

  const canonicalRes = await db
    .from('messages')
    .insert(canonical)
    .select('id')
    .maybeSingle();

  if (!canonicalRes.error && canonicalRes.data?.id) {
    return {
      ok: true,
      messageId: String(canonicalRes.data.id),
      duplicate: false,
    };
  }

  if (isUniqueViolation(canonicalRes.error)) {
    const raced = await lookupExistingMessage(
      input.accountId,
      input.providerMessageId
    );
    if (raced) {
      return { ok: true, messageId: raced.id, duplicate: true };
    }
  }

  const reduced: Record<string, unknown> = {
    conversation_id: input.conversationId,
    sender_type: 'agent',
    content_type: input.contentType || 'text',
    content_text: input.contentText,
    media_url: input.mediaUrl || null,
    template_name: input.templateName || null,
    message_id: input.providerMessageId,
    status: 'sent',
    created_at: now,
  };
  if (replyToId) reduced.reply_to_message_id = replyToId;

  const reducedRes = await db
    .from('messages')
    .insert(reduced)
    .select('id')
    .maybeSingle();

  if (!reducedRes.error && reducedRes.data?.id) {
    return {
      ok: true,
      messageId: String(reducedRes.data.id),
      duplicate: false,
    };
  }

  if (isUniqueViolation(reducedRes.error)) {
    const raced = await lookupExistingMessage(
      input.accountId,
      input.providerMessageId
    );
    if (raced) {
      return { ok: true, messageId: raced.id, duplicate: true };
    }
  }

  const error = errorMessage(reducedRes.error || canonicalRes.error);
  console.error('[whatsapp/send] Failed to persist outbound message:', error);
  return { ok: false, error };
}

/** Roll the conversation preview so the inbox list shows the outbound text. */
export async function touchConversationPreview(input: {
  accountId: string;
  conversationId: string;
  previewText: string;
  messageAt?: string;
}): Promise<void> {
  const db = getAdminClient();
  const now = input.messageAt || new Date().toISOString();
  const patch = {
    last_message_text: input.previewText,
    last_message_at: now,
    updated_at: now,
  };

  const canonical = await db
    .from('conversations')
    .update(patch)
    .eq('id', input.conversationId)
    .eq('account_id', input.accountId);
  if (!canonical.error) return;

  await db
    .from('conversations')
    .update({
      lastMessageText: input.previewText,
      lastMessageAt: now,
      updatedAt: now,
    })
    .eq('id', input.conversationId)
    .eq('accountId', input.accountId);
}

/**
 * Yield any active Flow run for this contact. An agent reply is the
 * strongest "human is here" signal; pausing (not ending) keeps diagnostic
 * state for the stale-run sweep.
 */
export async function pauseActiveFlowRuns(input: {
  accountId: string;
  contactId?: string | null;
}): Promise<void> {
  if (!input.contactId) return;
  const db = getAdminClient();
  const now = new Date().toISOString();

  const canonical = await db
    .from('flow_runs')
    .update({
      status: 'paused_by_agent',
      ended_at: now,
      end_reason: 'agent_replied',
    })
    .eq('account_id', input.accountId)
    .eq('contact_id', input.contactId)
    .eq('status', 'active');

  if (!canonical.error) return;

  await db
    .from('flow_runs')
    .update({
      status: 'paused_by_agent',
      endedAt: now,
      endReason: 'agent_replied',
    })
    .eq('accountId', input.accountId)
    .eq('contactId', input.contactId)
    .eq('status', 'active');
}

export function outboundPreviewText(input: {
  contentText?: string | null;
  contentType: string;
}): string {
  return input.contentText || `[${input.contentType}]`;
}
