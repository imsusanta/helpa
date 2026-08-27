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
  'account_id',
  'direction',
  'status',
  'created_at',
]);

const OPTIONAL_COLUMNS = new Set([
  'template_name',
  'sender_id',
  'media_url',
  'updated_at',
  'reply_to_message_id',
  'provider_message_id',
  'id',
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
): Promise<{ id: string; conversationId?: string } | null> {
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
            .select('id, conversation_id')
            .eq(attempt.account, accountId)
            .eq(attempt.id, providerMessageId)
        : db
            .from('messages')
            .select('id, conversation_id')
            .eq(attempt.id, providerMessageId);
      const { data } = await query.maybeSingle();
      if (data?.id) {
        return {
          id: String(data.id),
          conversationId: data.conversation_id
            ? String(data.conversation_id)
            : undefined,
        };
      }
    } catch {
      // Compatibility lookup; continue to the next canonical/legacy key.
    }
  }

  return null;
}

async function verifyConversationOwnership(
  db: ReturnType<typeof getAdminClient>,
  accountId: string,
  conversationId: string
): Promise<boolean> {
  try {
    const { data, error } = await db
      .from('conversations')
      .select('id, account_id')
      .eq('id', conversationId)
      .eq('account_id', accountId)
      .maybeSingle();
    if (!error && data?.id) return true;
  } catch {}

  try {
    const { data, error } = await db
      .from('conversations')
      .select('id, accountId')
      .eq('id', conversationId)
      .eq('accountId', accountId)
      .maybeSingle();
    if (!error && data?.id) return true;
  } catch {}

  return false;
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

  // Optional columns are populated only when supplied. The Inbox uses
  // sender_type/direction for outbound detection, so sender_id is not needed
  // to make the row render.
  if (input.mediaUrl) payload.media_url = input.mediaUrl;
  if (input.templateName) payload.template_name = input.templateName;
  if (isValidUuid(input.replyToMessageId)) {
    payload.reply_to_message_id = input.replyToMessageId;
  }

  return payload;
}

export async function persistOutboundMessage(
  input: PersistOutboundMessageInput
): Promise<PersistOutboundMessageResult> {
  try {
    const db = getAdminClient();

    if (!input.accountId || !input.conversationId || !input.providerMessageId) {
      return {
        ok: false,
        error: 'Missing required outbound message identity fields',
      };
    }

    const ownsConversation = await verifyConversationOwnership(
      db,
      input.accountId,
      input.conversationId
    );
    if (!ownsConversation) {
      return {
        ok: false,
        error: 'Outbound message conversation/account ownership check failed',
      };
    }

    const now = new Date().toISOString();
    const existing = await lookupExistingMessage(
      input.accountId,
      input.providerMessageId
    );
    if (existing) {
      if (
        existing.conversationId &&
        String(existing.conversationId) !== String(input.conversationId)
      ) {
        return {
          ok: false,
          error: 'Provider message ID already belongs to another conversation',
        };
      }
      return { ok: true, messageId: existing.id, duplicate: true };
    }

    const payload = buildOutboundPayload(input, now);
    let lastError: unknown = null;

    // Never remove required Inbox identity fields. Only schema-optional
    // compatibility columns may be stripped after an unknown-column error.
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
          if (
            raced.conversationId &&
            String(raced.conversationId) !== String(input.conversationId)
          ) {
            return {
              ok: false,
              error: 'Provider message ID already belongs to another conversation',
            };
          }
          return { ok: true, messageId: raced.id, duplicate: true };
        }
      }

      const missing = missingColumnName(insertRes.error);
      if (missing && REQUIRED_INSERT_COLUMNS.has(missing)) break;

      const optionalMissing =
        missing && OPTIONAL_COLUMNS.has(missing) ? missing : null;
      if (!optionalMissing && !isUnknownColumnError(insertRes.error)) break;

      const strip =
        optionalMissing ||
        (isUnknownColumnError(insertRes.error)
          ? ['template_name', 'sender_id', 'media_url', 'updated_at', 'reply_to_message_id', 'provider_message_id', 'id'].find(
              (column) => column in payload
            )
          : undefined);

      if (!strip || !OPTIONAL_COLUMNS.has(strip)) break;

      console.warn(
        `[whatsapp/send] messages schema is missing optional column ${strip}; retrying without it`
      );
      delete payload[strip];
    }

    const error = errorMessage(lastError);
    console.error('[whatsapp/send] Failed to persist outbound message:', {
      accountId: input.accountId,
      conversationId: input.conversationId,
      providerMessageId: input.providerMessageId,
      error: errorCode(lastError) ? `${errorCode(lastError)}: ${error}` : error,
    });
    return { ok: false, error };
  } catch (err) {
    const error = errorMessage(err);
    console.error('[whatsapp/send] Failed to persist outbound message:', {
      accountId: input.accountId,
      conversationId: input.conversationId,
      providerMessageId: input.providerMessageId,
      error,
    });
    return { ok: false, error };
  }
}

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
