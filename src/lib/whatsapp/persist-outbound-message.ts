import { getAdminClient } from '@/lib/db/server';

export interface PersistOutboundMessageInput {
  accountId: string;
  conversationId: string;
  senderId?: string | null;
  senderType?: 'agent' | 'bot';
  contentType: string;
  contentText: string | null;
  mediaUrl?: string | null;
  templateName?: string | null;
  providerMessageId: string;
  replyToMessageId?: string | null;
  createdAt?: string;
}

export type PersistOutboundMessageResult =
  | { ok: true; messageId: string; duplicate: boolean }
  | { ok: false; error: string };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const STATUS_FALLBACKS = ['delivered', 'sent', 'pending', 'sending'] as const;

const REQUIRED_INSERT_COLUMNS = new Set([
  'conversation_id',
  'conversationId',
  'sender_type',
  'senderType',
  'content_type',
  'contentType',
  'message_id',
  'messageId',
]);

const OPTIONAL_STRIP_ORDER = [
  'template_name',
  'sender_id',
  'interactive_reply_id',
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

export function formatPersistError(error: unknown): string {
  if (!error || typeof error !== 'object') return errorMessage(error);
  const candidate = error as {
    code?: unknown;
    message?: unknown;
    details?: unknown;
    hint?: unknown;
  };
  return [candidate.code, candidate.message, candidate.details, candidate.hint]
    .filter((value) => typeof value === 'string' && value)
    .join(' — ');
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

function isForeignKeyViolation(error: unknown): boolean {
  return (
    errorCode(error) === '23503' ||
    /foreign key constraint/i.test(errorBlob(error))
  );
}

function isCheckConstraint(error: unknown, column?: string): boolean {
  const blob = errorBlob(error);
  const matches =
    errorCode(error) === '23514' ||
    /check constraint|invalid input value/i.test(blob);
  if (!matches) return false;
  if (!column) return true;
  return (
    blob.includes(column) ||
    blob.includes(`${column}_check`) ||
    new RegExp(`\\b${column}\\b`, 'i').test(blob)
  );
}

function isInvalidUuid(error: unknown): boolean {
  return (
    errorCode(error) === '22P02' ||
    /invalid input syntax for type uuid/i.test(errorBlob(error))
  );
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
    { id: 'messageId' },
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
      const { data } = await query.limit(1);
      const row = Array.isArray(data) ? data[0] : data;
      if (row?.id) return { id: String(row.id) };
    } catch {
      // Column may not exist on this schema; try the next lookup.
    }
  }

  return null;
}

type PayloadShape = 'canonical' | 'reduced' | 'legacy';

function outboundSenderType(
  input: PersistOutboundMessageInput
): 'agent' | 'bot' {
  return input.senderType === 'bot' ? 'bot' : 'agent';
}

function buildOutboundPayload(
  shape: PayloadShape,
  input: PersistOutboundMessageInput,
  now: string
): Record<string, unknown> {
  const replyTo = isValidUuid(input.replyToMessageId)
    ? input.replyToMessageId
    : null;
  const senderType = outboundSenderType(input);

  // Canonical/reduced copies of the working inbound webhook insert in
  // process-message.ts. Inbound uses status `delivered` (Meta already
  // accepted this outbound send too) and always sends the nullable
  // media/reply/interactive columns. Extra columns like `id`,
  // `template_name`, and `sender_id` are what made earlier outbound
  // persists fail against the live hybrid schema.
  if (shape === 'canonical') {
    return {
      account_id: input.accountId,
      conversation_id: input.conversationId,
      direction: 'outbound',
      sender_type: senderType,
      content_type: input.contentType || 'text',
      content_text: input.contentText,
      media_url: input.mediaUrl || null,
      message_id: input.providerMessageId,
      provider_message_id: input.providerMessageId,
      status: 'delivered',
      reply_to_message_id: replyTo,
      interactive_reply_id: null,
      created_at: now,
      updated_at: now,
    };
  }

  if (shape === 'reduced') {
    return {
      conversation_id: input.conversationId,
      sender_type: senderType,
      content_type: input.contentType || 'text',
      content_text: input.contentText,
      media_url: input.mediaUrl || null,
      message_id: input.providerMessageId,
      status: 'delivered',
      reply_to_message_id: replyTo,
      interactive_reply_id: null,
      created_at: now,
    };
  }

  return {
    conversationId: input.conversationId,
    senderType,
    contentType: input.contentType || 'text',
    contentText: input.contentText,
    mediaUrl: input.mediaUrl || null,
    messageId: input.providerMessageId,
    status: 'delivered',
    replyToMessageId: replyTo,
    interactiveReplyId: null,
    createdAt: now,
  };
}

function nextFallback<T extends string>(
  current: unknown,
  options: readonly T[]
): T | null {
  const index = options.indexOf(current as T);
  if (index < 0) return options[0] ?? null;
  return options[index + 1] ?? null;
}

function mutatePayloadForError(
  payload: Record<string, unknown>,
  error: unknown
): boolean {
  const missing = missingColumnName(error);
  if (missing && REQUIRED_INSERT_COLUMNS.has(missing)) {
    return false;
  }
  if (missing && missing in payload) {
    delete payload[missing];
    return true;
  }
  if (!missing && isUnknownColumnError(error)) {
    const strip = OPTIONAL_STRIP_ORDER.find((column) => column in payload);
    if (strip) {
      delete payload[strip];
      return true;
    }
  }

  if (
    isCheckConstraint(error, 'status') ||
    isCheckConstraint(error, 'Status')
  ) {
    const next = nextFallback(payload.status, STATUS_FALLBACKS);
    if (next && next !== payload.status) {
      payload.status = next;
      return true;
    }
  }

  if (
    isCheckConstraint(error, 'sender_type') ||
    isCheckConstraint(error, 'senderType')
  ) {
    const key = 'sender_type' in payload ? 'sender_type' : 'senderType';
    const current = String(payload[key] || '');
    const next = current === 'bot' ? 'agent' : 'bot';
    if (next !== current) {
      payload[key] = next;
      return true;
    }
  }

  if (isCheckConstraint(error, 'direction') && 'direction' in payload) {
    delete payload.direction;
    return true;
  }

  if (
    isCheckConstraint(error, 'content_type') ||
    isCheckConstraint(error, 'contentType')
  ) {
    const key = 'content_type' in payload ? 'content_type' : 'contentType';
    if (payload[key] !== 'text') {
      payload[key] = 'text';
      return true;
    }
  }

  if (isInvalidUuid(error) || isForeignKeyViolation(error)) {
    for (const key of [
      'reply_to_message_id',
      'replyToMessageId',
      'account_id',
    ]) {
      if (key in payload && payload[key] != null) {
        if (key === 'account_id') {
          delete payload[key];
        } else {
          payload[key] = null;
        }
        return true;
      }
    }
  }

  return false;
}

async function insertWithRetries(
  payload: Record<string, unknown>
): Promise<{ inserted: boolean; unique: boolean; error: unknown }> {
  const db = getAdminClient();
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 12; attempt++) {
    const insertRes = await db.from('messages').insert(payload);
    if (!insertRes.error) {
      return { inserted: true, unique: false, error: null };
    }

    lastError = insertRes.error;
    if (isUniqueViolation(insertRes.error)) {
      return { inserted: false, unique: true, error: insertRes.error };
    }

    if (mutatePayloadForError(payload, insertRes.error)) {
      console.warn(
        '[whatsapp/send] messages insert rejected; retrying with adjusted payload'
      );
      continue;
    }

    break;
  }

  return { inserted: false, unique: false, error: lastError };
}

/**
 * Persist a Meta-accepted outbound WhatsApp message into `messages`.
 *
 * The inbox thread and conversation list both read this table. Sending to
 * Meta without writing a local row is how outbound bubbles disappear after
 * refresh: WhatsApp delivers the message, but `/inbox` has nothing to show.
 *
 * Insert shapes copy the working inbound webhook in process-message.ts:
 * canonical snake_case, then reduced (pre-cutover), then camelCase. Within
 * each shape we also strip unknown columns and retry check/FK failures.
 */
export async function persistOutboundMessage(
  input: PersistOutboundMessageInput
): Promise<PersistOutboundMessageResult> {
  try {
    const parsedCreatedAt = input.createdAt
      ? Date.parse(input.createdAt)
      : Number.NaN;
    const now = Number.isFinite(parsedCreatedAt)
      ? new Date(parsedCreatedAt).toISOString()
      : new Date().toISOString();
    const existing = await lookupExistingMessage(
      input.accountId,
      input.providerMessageId
    );
    if (existing) {
      return { ok: true, messageId: existing.id, duplicate: true };
    }

    let lastError: unknown = null;
    const shapes: PayloadShape[] = ['canonical', 'reduced', 'legacy'];

    for (const shape of shapes) {
      const payload = buildOutboundPayload(shape, input, now);
      const result = await insertWithRetries(payload);
      if (result.inserted || result.unique) {
        const lookedUp = await lookupExistingMessage(
          input.accountId,
          input.providerMessageId
        );
        return {
          ok: true,
          messageId: lookedUp?.id || '',
          duplicate: result.unique,
        };
      }
      lastError = result.error;
    }

    const error = formatPersistError(lastError) || errorMessage(lastError);
    console.error('[whatsapp/send] Failed to persist outbound message:', error);
    return { ok: false, error };
  } catch (err) {
    const error = formatPersistError(err) || errorMessage(err);
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
