import { appwriteAdmin } from '@/lib/appwrite-server-compat';

const OUTBOX_TABLE = 'whatsapp_outbox';

export interface OutboxEntryPayload {
  accountId: string;
  idempotencyKey: string;
  requestHash: string;
  channel: string;
  conversationId?: string;
  contactId?: string | null;
  provider?: string;
}

export type OutboxCreateResult =
  | {
      ok: true;
      status: 'created' | 'existing';
      outboxId: string;
      existingStatus?: string;
      providerMessageId?: string;
      requestHashMatches: boolean;
    }
  | {
      ok: false;
      code: 'OUTBOX_PERSISTENCE_FAILED' | 'IDEMPOTENCY_CONFLICT';
      message: string;
      retryable: boolean;
    };

type OutboxRow = Record<string, unknown>;

function extractRequestHash(row: OutboxRow): string {
  return String(
    (row.payload as Record<string, unknown> | undefined)?.requestHash ||
      row.requestHash ||
      ''
  );
}

function existingResult(
  row: OutboxRow,
  requestHash: string
): OutboxCreateResult {
  const storedHash = extractRequestHash(row);
  if (storedHash && storedHash !== requestHash) {
    return {
      ok: false,
      code: 'IDEMPOTENCY_CONFLICT',
      message:
        'Idempotency key has already been used with a different message payload',
      retryable: false,
    };
  }

  return {
    ok: true,
    status: 'existing',
    outboxId: String(row.id || row.$id),
    existingStatus: String(row.status || 'processing'),
    providerMessageId: row.meta_message_id
      ? String(row.meta_message_id)
      : row.providerMessageId
        ? String(row.providerMessageId)
        : undefined,
    requestHashMatches: true,
  };
}

function validatePayload(payload: OutboxEntryPayload): string | null {
  if (!payload.accountId?.trim()) return 'accountId is required';
  if (!payload.idempotencyKey?.trim()) return 'idempotencyKey is required';
  if (!payload.requestHash?.trim()) return 'requestHash is required';
  return null;
}

export class OutboxService {
  static async createPreSendOutbox(
    payload: OutboxEntryPayload
  ): Promise<OutboxCreateResult> {
    const validationError = validatePayload(payload);
    if (validationError) {
      return {
        ok: false,
        code: 'OUTBOX_PERSISTENCE_FAILED',
        message: validationError,
        retryable: false,
      };
    }

    const database = appwriteAdmin();

    try {
      const { data: existing, error: lookupError } = await database
        .from(OUTBOX_TABLE)
        .select('*')
        .eq('account_id', payload.accountId)
        .eq('idempotency_key', payload.idempotencyKey)
        .maybeSingle();

      if (lookupError) {
        return {
          ok: false,
          code: 'OUTBOX_PERSISTENCE_FAILED',
          message: lookupError.message || 'Failed to query durable outbox',
          retryable: true,
        };
      }
      if (existing) return existingResult(existing as OutboxRow, payload.requestHash);

      const now = new Date().toISOString();
      const { data, error } = await database
        .from(OUTBOX_TABLE)
        .insert({
          account_id: payload.accountId,
          idempotency_key: payload.idempotencyKey,
          conversation_id: payload.conversationId || null,
          contact_id: payload.contactId || null,
          message_type: 'text',
          payload: {
            requestHash: payload.requestHash,
            channel: payload.channel || 'whatsapp',
            provider: payload.provider || 'meta',
          },
          status: 'processing',
          attempt_count: 0,
          available_at: now,
          created_at: now,
          updated_at: now,
        })
        .select('id')
        .single();

      if (data?.id) {
        return {
          ok: true,
          status: 'created',
          outboxId: String(data.id),
          requestHashMatches: true,
        };
      }

      const isConflict =
        error?.code === 409 ||
        error?.code === '23505' ||
        /duplicate|conflict|unique/i.test(error?.message || '');

      if (isConflict) {
        const { data: concurrentRow, error: recheckError } = await database
          .from(OUTBOX_TABLE)
          .select('*')
          .eq('account_id', payload.accountId)
          .eq('idempotency_key', payload.idempotencyKey)
          .maybeSingle();

        if (!recheckError && concurrentRow) {
          return existingResult(
            concurrentRow as OutboxRow,
            payload.requestHash
          );
        }
      }

      return {
        ok: false,
        code: 'OUTBOX_PERSISTENCE_FAILED',
        message: error?.message || 'Failed to persist durable outbox',
        retryable: true,
      };
    } catch (error) {
      return {
        ok: false,
        code: 'OUTBOX_PERSISTENCE_FAILED',
        message: error instanceof Error ? error.message : String(error),
        retryable: true,
      };
    }
  }

  static async markSent(
    outboxId: string,
    accountId: string,
    providerMessageId: string
  ): Promise<void> {
    const { error } = await appwriteAdmin()
      .from(OUTBOX_TABLE)
      .update({
        status: 'sent',
        meta_message_id: providerMessageId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', outboxId)
      .eq('account_id', accountId);

    if (error) throw new Error(`OUTBOX_MARK_SENT_FAILED: ${error.message}`);
  }

  static async markReconciliationRequired(
    outboxId: string,
    accountId: string,
    providerMessageId: string,
    databaseError: string
  ): Promise<void> {
    const { error } = await appwriteAdmin()
      .from(OUTBOX_TABLE)
      .update({
        status: 'reconciliation_required',
        meta_message_id: providerMessageId,
        error_message: databaseError.slice(0, 255),
        available_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', outboxId)
      .eq('account_id', accountId);

    if (error) {
      throw new Error(`OUTBOX_RECONCILIATION_MARK_FAILED: ${error.message}`);
    }
  }

  static async markDeadLetter(
    outboxId: string,
    accountId: string,
    errorMessage: string
  ): Promise<void> {
    const { error } = await appwriteAdmin()
      .from(OUTBOX_TABLE)
      .update({
        status: 'dead_letter',
        error_message: errorMessage.slice(0, 255),
        updated_at: new Date().toISOString(),
      })
      .eq('id', outboxId)
      .eq('account_id', accountId);

    if (error) throw new Error(`OUTBOX_DEAD_LETTER_FAILED: ${error.message}`);
  }

  /** Repairs local message state without resending to Meta. */
  static async reconcilePendingMessages(): Promise<number> {
    const database = appwriteAdmin();
    const { data, error } = await database
      .from(OUTBOX_TABLE)
      .select('*')
      .eq('status', 'reconciliation_required')
      .limit(20);

    if (error) throw new Error(`OUTBOX_RECONCILIATION_SCAN_FAILED: ${error.message}`);

    let reconciled = 0;
    for (const row of (data || []) as OutboxRow[]) {
      const outboxId = String(row.id || '');
      const accountId = String(row.account_id || '');
      const conversationId = String(row.conversation_id || '');
      const providerMessageId = String(row.meta_message_id || '');

      if (!outboxId || !accountId || !conversationId || !providerMessageId) {
        continue;
      }

      try {
        const { data: existing, error: lookupError } = await database
          .from('messages')
          .select('id')
          .eq('account_id', accountId)
          .eq('provider_message_id', providerMessageId)
          .maybeSingle();
        if (lookupError) throw lookupError;

        if (!existing) {
          const now = new Date().toISOString();
          const { error: insertError } = await database.from('messages').insert({
            account_id: accountId,
            conversation_id: conversationId,
            direction: 'outbound',
            content_type: 'text',
            content_text: 'Message sent (reconciled)',
            provider_message_id: providerMessageId,
            status: 'sent',
            created_at: now,
            updated_at: now,
          });
          if (insertError) throw insertError;
        }

        await this.markSent(outboxId, accountId, providerMessageId);
        reconciled++;
      } catch (reconciliationError) {
        console.error('[OutboxService] reconciliation failed', {
          outboxId,
          error:
            reconciliationError instanceof Error
              ? reconciliationError.message
              : String(reconciliationError),
        });
      }
    }

    return reconciled;
  }
}
