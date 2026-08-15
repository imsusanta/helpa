import { appwriteAdmin } from '@/lib/appwrite-server-compat';

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

export class OutboxService {
  /**
   * Pre-send durable Outbox persistence with strict idempotency and hash verification.
   */
  static async createPreSendOutbox(
    payload: OutboxEntryPayload
  ): Promise<OutboxCreateResult> {
    const dbAdmin = appwriteAdmin();
    const now = new Date().toISOString();

    // 1. Check if an existing outbox record already exists for (accountId, idempotencyKey)
    let existingDoc: Record<string, unknown> | null = null;
    try {
      const { data } = await dbAdmin
        .from('outbound_outbox')
        .select('*')
        .eq('account_id', payload.accountId)
        .eq('idempotency_key', payload.idempotencyKey)
        .maybeSingle();
      if (data) existingDoc = data as Record<string, unknown>;
    } catch {
      // Fallback
    }

    if (!existingDoc) {
      try {
        const { data } = await dbAdmin
          .from('outbound_outbox')
          .select('*')
          .eq('accountId', payload.accountId)
          .eq('idempotencyKey', payload.idempotencyKey)
          .maybeSingle();
        if (data) existingDoc = data as Record<string, unknown>;
      } catch {
        // Ignore
      }
    }

    if (existingDoc) {
      const existingHash = String(
        (existingDoc.payload as Record<string, unknown>)?.requestHash ||
          existingDoc.requestHash ||
          existingDoc.request_hash ||
          ''
      );
      const hashMatches = !existingHash || existingHash === payload.requestHash;

      if (!hashMatches) {
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
        outboxId: String(existingDoc.id || existingDoc.$id),
        existingStatus: String(existingDoc.status || 'processing'),
        providerMessageId: existingDoc.meta_message_id
          ? String(existingDoc.meta_message_id)
          : existingDoc.metaMessageId
            ? String(existingDoc.metaMessageId)
            : existingDoc.providerMessageId
              ? String(existingDoc.providerMessageId)
              : undefined,
        requestHashMatches: true,
      };
    }

    // 2. Insert new outbox record before sending to Meta
    try {
      let createdId: string | null = null;
      let insertError: { code?: unknown; message?: string } | null = null;

      const pgPayload = {
        account_id: payload.accountId,
        idempotency_key: payload.idempotencyKey,
        conversation_id: payload.conversationId || null,
        contact_id: payload.contactId || null,
        message_type: 'text',
        payload: {
          requestHash: payload.requestHash,
          channel: payload.channel || 'whatsapp',
        },
        status: 'processing',
        created_at: now,
        updated_at: now,
      };

      const res = await dbAdmin
        .from('outbound_outbox')
        .insert(pgPayload)
        .select('id')
        .single();

      if (res.data?.id) {
        createdId = String(res.data.id);
      } else {
        insertError = res.error;
        // Fallback to legacy schema
        const legacyRes = await dbAdmin
          .from('outbound_outbox')
          .insert({
            accountId: payload.accountId,
            idempotencyKey: payload.idempotencyKey,
            requestHash: payload.requestHash,
            channel: payload.channel || 'whatsapp',
            conversationId: payload.conversationId,
            contactId: payload.contactId || null,
            status: 'processing',
            attempts: 0,
            createdAt: now,
            updatedAt: now,
          })
          .select('id')
          .single();

        if (legacyRes.data?.id) {
          createdId = String(legacyRes.data.id);
          insertError = null;
        } else {
          insertError = legacyRes.error || insertError;
        }
      }

      if (!createdId) {
        // Check for concurrent conflict
        const isConflict =
          insertError?.code === 409 ||
          insertError?.code === '23505' ||
          /duplicate|conflict|unique/i.test(insertError?.message || '');

        if (isConflict) {
          const { data: recheck } = await dbAdmin
            .from('outbound_outbox')
            .select('*')
            .eq('account_id', payload.accountId)
            .eq('idempotency_key', payload.idempotencyKey)
            .maybeSingle();

          if (recheck) {
            const recheckDoc = recheck as Record<string, unknown>;
            const existingHash = String(
              (recheckDoc.payload as Record<string, unknown>)?.requestHash ||
                recheckDoc.requestHash ||
                recheckDoc.request_hash ||
                ''
            );
            const hashMatches =
              !existingHash || existingHash === payload.requestHash;
            if (!hashMatches) {
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
              outboxId: String(recheckDoc.id || recheckDoc.$id),
              existingStatus: String(recheckDoc.status || 'processing'),
              providerMessageId: recheckDoc.meta_message_id
                ? String(recheckDoc.meta_message_id)
                : recheckDoc.metaMessageId
                  ? String(recheckDoc.metaMessageId)
                  : undefined,
              requestHashMatches: true,
            };
          }
        }

        return {
          ok: false,
          code: 'OUTBOX_PERSISTENCE_FAILED',
          message:
            insertError?.message ||
            'Failed to persist durable outbox before provider send',
          retryable: true,
        };
      }

      return {
        ok: true,
        status: 'created',
        outboxId: createdId,
        requestHashMatches: true,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        code: 'OUTBOX_PERSISTENCE_FAILED',
        message: `Unexpected error persisting outbox: ${message}`,
        retryable: true,
      };
    }
  }

  /**
   * Mark outbox record as sent with Meta provider message ID.
   */
  static async markSent(
    outboxId: string,
    accountId: string,
    providerMessageId: string
  ): Promise<void> {
    const dbAdmin = appwriteAdmin();
    const now = new Date().toISOString();
    try {
      const res = await dbAdmin
        .from('outbound_outbox')
        .update({
          status: 'sent',
          meta_message_id: providerMessageId,
          updated_at: now,
        })
        .eq('id', outboxId)
        .eq('account_id', accountId);
      if (res.error) {
        await dbAdmin
          .from('outbound_outbox')
          .update({
            status: 'sent',
            metaMessageId: providerMessageId,
            updatedAt: now,
          })
          .eq('id', outboxId)
          .eq('accountId', accountId);
      }
    } catch (err: unknown) {
      console.warn(
        '[OutboxService] Failed to mark outbox sent:',
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  /**
   * Handle Meta success when local DB persistence fails.
   * Marks outbox as reconciliation_required so the worker can repair local messages
   * WITHOUT resending to Meta!
   */
  static async markReconciliationRequired(
    outboxId: string,
    accountId: string,
    providerMessageId: string,
    dbErrorMessage: string
  ): Promise<void> {
    const dbAdmin = appwriteAdmin();
    const now = new Date().toISOString();
    try {
      const res = await dbAdmin
        .from('outbound_outbox')
        .update({
          status: 'reconciliation_required',
          meta_message_id: providerMessageId,
          error_message: dbErrorMessage.slice(0, 255),
          updated_at: now,
        })
        .eq('id', outboxId)
        .eq('account_id', accountId);
      if (res.error) {
        await dbAdmin
          .from('outbound_outbox')
          .update({
            status: 'reconciliation_required',
            metaMessageId: providerMessageId,
            lastErrorCode: dbErrorMessage.slice(0, 255),
            updatedAt: now,
          })
          .eq('id', outboxId)
          .eq('accountId', accountId);
      }
    } catch (err: unknown) {
      console.error(
        '[OutboxService] Failed to mark outbox reconciliation_required:',
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  /**
   * Mark outbox record as dead_letter on provider error.
   */
  static async markDeadLetter(
    outboxId: string,
    accountId: string,
    errorMessage: string
  ): Promise<void> {
    const dbAdmin = appwriteAdmin();
    const now = new Date().toISOString();
    try {
      const res = await dbAdmin
        .from('outbound_outbox')
        .update({
          status: 'dead_letter',
          error_message: errorMessage.slice(0, 255),
          updated_at: now,
        })
        .eq('id', outboxId)
        .eq('account_id', accountId);
      if (res.error) {
        await dbAdmin
          .from('outbound_outbox')
          .update({
            status: 'dead_letter',
            lastErrorCode: errorMessage.slice(0, 255),
            attempts: 1,
            updatedAt: now,
          })
          .eq('id', outboxId)
          .eq('accountId', accountId);
      }
    } catch (err: unknown) {
      console.warn(
        '[OutboxService] Failed to mark outbox dead_letter:',
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  /**
   * Background reconciliation for reconciliation_required outbox documents.
   * Creates local message records without resending to Meta.
   */
  static async reconcilePendingMessages(): Promise<number> {
    const dbAdmin = appwriteAdmin();
    let pending: Record<string, unknown>[] = [];
    try {
      const { data } = await dbAdmin
        .from('outbound_outbox')
        .select('*')
        .eq('status', 'reconciliation_required')
        .limit(20);
      if (data && Array.isArray(data)) {
        pending = data as Record<string, unknown>[];
      }
    } catch {
      // Ignore
    }

    if (pending.length === 0) {
      return 0;
    }

    let reconciledCount = 0;
    for (const doc of pending) {
      const docId = String(doc.id || doc.$id || '');
      const accountId = String(doc.account_id || doc.accountId || '');
      const conversationId = String(
        doc.conversation_id || doc.conversationId || ''
      );
      const providerMessageId = String(
        doc.meta_message_id || doc.metaMessageId || doc.providerMessageId || ''
      );

      if (!docId || !accountId || !conversationId || !providerMessageId) {
        continue;
      }

      try {
        // Check if message already exists
        let existingMsg: { id: string } | null = null;
        try {
          const { data } = await dbAdmin
            .from('messages')
            .select('id')
            .eq('account_id', accountId)
            .eq('message_id', providerMessageId)
            .maybeSingle();
          if (data) existingMsg = data;
        } catch {
          // Fallback
        }

        if (!existingMsg) {
          const now = new Date().toISOString();
          await dbAdmin.from('messages').insert({
            account_id: accountId,
            conversation_id: conversationId,
            sender_type: 'agent',
            content_type: 'text',
            content_text: 'Message sent (reconciled)',
            message_id: providerMessageId,
            status: 'sent',
            created_at: now,
            updated_at: now,
          });
        }

        await this.markSent(docId, accountId, providerMessageId);
        reconciledCount++;
      } catch (err) {
        console.error(
          `[OutboxService] Reconcile error for doc ${docId}:`,
          err instanceof Error ? err.message : String(err)
        );
      }
    }

    return reconciledCount;
  }
}
