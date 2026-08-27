import { getAdminClient } from '@/lib/db/server';
import crypto from 'node:crypto';

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

const REQUIRED_INSERT_COLUMNS = new Set([
  'conversation_id',
  'sender_type',
  'content_type',
  'message_id',
]);

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

const OPTIONAL_STRIP_ORDER = [
  'template_name',
  'sender_id',
  'media_url',
  'updated_at',
  'reply_to_message_id',
  'provider_message_id',
  'account_id',
  'direction',
  'status',
  'created_at',
  'id',
] as const;

function errorCode(error: unknown): string {
  if (!error || typeof error !== 'object') return '';
  const code = (error as { code?: unknown }).code;
  return code == null ? '' : String(code);
}

function errorBlob(error: unknown): string {
  if (!error || typeof error !== 'object') return errorMessage(error);
  const candidate = error as {
    message?: unknown;
    details?: unknown;
    hint?: unknown;
  };
  return [candidate.message, candidate.details, candidate.hint]
    .filter((value) => typeof value === 'string' && value)
    .join(' ');
}

/** PostgREST/Postgres unknown-column errors (schema cache miss or 42703). */
export function missingColumnName(error: unknown): string | null {
  const message = errorBlob(error) || errorMessage(error);
  const match =
    message.match(/Could not find the '([^']+)' column/i) ||
    message.match(/column "([^"]+)" of relation/i) ||
    message.match(/column "([^"]+)" does not exist/i);
  return match?.[1] ?? null;
}

function isUnknownColumnError(error: unknown): boolean {
  const code = errorCode(error);
  return (
    code === 'PGRST204' || code === '42703' || Boolean(missingColumnName(error))
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

function buildOutboundPayload(
  input: PersistOutboundMessageInput,
  now: string
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    id: crypto.randomUUID(),
    account_id: input.accountId,
    conversation_id: input.conversationId,
    direction: 'outbound',
    provider_message_id: input.providerMessageId,
    sender_type: 'agent',
    content_type: input.contentType || 'text',
    content_text: input.contentText,
    message_id: input.providerMessageId,
    status: 'sent',
    created_at: now,
    updated_at: now,
  };

  // Only send optional columns when they have values. The working inbound
  // insert never sends `template_name` or `sender_id`; those columns are
  // missing on the canonical-cutover messages table, and posting them
  // (even as null) makes PostgREST reject the whole row (PGRST204 / 42703).
  // Inbox alignment uses `sender_type = 'agent'`, so we deliberately omit
  // `sender_id` even when the agent UUID is known.
  if (input.mediaUrl) payload.media_url = input.mediaUrl;
  if (input.templateName) payload.template_name = input.templateName;
  if (isValidUuid(input.replyToMessageId)) {
    payload.reply_to_message_id = input.replyToMessageId;
  }

  return payload;
}

/**
 * Persist a Meta-accepted outbound WhatsApp message into `messages`.
 *
 * The inbox thread and conversation list both read this table. Sending to
 * Meta without writing a local row is how outbound bubbles disappear after
 * refresh: WhatsApp delivers the message, but `/inbox` has nothing to show.
 *
 * Column set matches the working inbound webhook insert, then retries while
 * stripping unknown columns so a schema that lacks `template_name` /
 * `sender_id` / `updated_at` still stores the bubble.
 */
export async function persistOutboundMessage(
  input: PersistOutboundMessageInput
): Promise<PersistOutboundMessageResult> {
  try {
    const db = getAdminClient();
    const now = new Date().toISOString();
    const existing = await lookupExistingMessage(
      input.accountId,
      input.providerMessageId
    );
    if (existing) {
      return { ok: true, messageId: existing.id, duplicate: true };
    }

    const payload = buildOutboundPayload(input, now);
    let lastError: unknown = null;

    for (let attempt = 0; attempt < 12; attempt++) {
      const insertRes = await db.from('messages').insert(payload);
      if (!insertRes.error) {
        return {
          ok: true,
          messageId: String(payload.id),
          duplicate: false,
        };
      }

      lastError = insertRes.error;
      if (isUniqueViolation(insertRes.error)) {
        const raced = await lookupExistingMessage(
          input.accountId,
          input.providerMessageId
        );
        if (raced) {
          return { ok: true, messageId: raced.id, duplicate: true };
        }
      }

      const missing = missingColumnName(insertRes.error);
      if (missing && REQUIRED_INSERT_COLUMNS.has(missing)) {
        break;
      }

      const strip =
        missing && missing in payload
          ? missing
          : isUnknownColumnError(insertRes.error)
            ? OPTIONAL_STRIP_ORDER.find((column) => column in payload)
            : undefined;

      if (!strip) break;

      console.warn(
        `[whatsapp/send] messages schema is missing ${strip}; retrying without it`
      );
      delete payload[strip];
    }

    const error = errorMessage(lastError);
    console.error('[whatsapp/send] Failed to persist outbound message:', error);
    return { ok: false, error };
  } catch (err) {
    const error = errorMessage(err);
    console.error('[whatsapp/send] Failed to persist outbound message:', error);
    return { ok: false, error };
  }
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
