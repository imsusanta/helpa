import { appwriteAdmin } from '@/lib/appwrite-server-compat';
import { APPWRITE_CONFIG } from '@/infrastructure/appwrite/config';

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
    const { data: existing, error: findError } = await dbAdmin
      .from(APPWRITE_CONFIG.collections.outboundOutbox)
      .select('*')
      .eq('accountId', payload.accountId)
      .eq('idempotencyKey', payload.idempotencyKey)
      .maybeSingle();

    if (!findError && existing) {
      const existingDoc = existing as Record<string, unknown>;
      const existingHash = String(existingDoc.requestHash || '');
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
        outboxId: String(existingDoc.$id || existingDoc.id),
        existingStatus: String(existingDoc.status || 'processing'),
        providerMessageId: existingDoc.providerMessageId
          ? String(existingDoc.providerMessageId)
          : existingDoc.metaMessageId
            ? String(existingDoc.metaMessageId)
            : undefined,
        requestHashMatches: true,
      };
    }

    // 2. Insert new outbox record before sending to Meta
    try {
      const { data: created, error: insertError } = await dbAdmin
        .from(APPWRITE_CONFIG.collections.outboundOutbox)
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

      if (insertError || !created?.id) {
        // Check for concurrent conflict
        const isConflict =
          insertError?.code === 409 ||
          /duplicate|conflict|unique/i.test(insertError?.message || '');

        if (isConflict) {
          const { data: recheck } = await dbAdmin
            .from(APPWRITE_CONFIG.collections.outboundOutbox)
            .select('*')
            .eq('accountId', payload.accountId)
            .eq('idempotencyKey', payload.idempotencyKey)
            .maybeSingle();

          if (recheck) {
            const recheckDoc = recheck as Record<string, unknown>;
            const hashMatches =
              !recheckDoc.requestHash ||
              recheckDoc.requestHash === payload.requestHash;
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
              outboxId: String(recheckDoc.$id || recheckDoc.id),
              existingStatus: String(recheckDoc.status || 'processing'),
              providerMessageId: recheckDoc.metaMessageId
                ? String(recheckDoc.metaMessageId)
                : recheckDoc.providerMessageId
                  ? String(recheckDoc.providerMessageId)
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
        outboxId: String(created.id),
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
    await dbAdmin
      .from(APPWRITE_CONFIG.collections.outboundOutbox)
      .update({
        status: 'sent',
        metaMessageId: providerMessageId,
        updatedAt: now,
      })
      .eq('id', outboxId)
      .eq('accountId', accountId)
      .catch((err: unknown) => {
        console.warn(
          '[OutboxService] Failed to mark outbox sent:',
          err instanceof Error ? err.message : String(err)
        );
      });
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
    await dbAdmin
      .from(APPWRITE_CONFIG.collections.outboundOutbox)
      .update({
        status: 'reconciliation_required',
        metaMessageId: providerMessageId,
        lastErrorCode: dbErrorMessage.slice(0, 255),
        updatedAt: now,
      })
      .eq('id', outboxId)
      .eq('accountId', accountId)
      .catch((err: unknown) => {
        console.error(
          '[OutboxService] Failed to mark outbox reconciliation_required:',
          err instanceof Error ? err.message : String(err)
        );
      });
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
    await dbAdmin
      .from(APPWRITE_CONFIG.collections.outboundOutbox)
      .update({
        status: 'dead_letter',
        lastErrorCode: errorMessage.slice(0, 255),
        attempts: 1,
        updatedAt: now,
      })
      .eq('id', outboxId)
      .eq('accountId', accountId)
      .catch((err: unknown) => {
        console.warn(
          '[OutboxService] Failed to mark outbox dead_letter:',
          err instanceof Error ? err.message : String(err)
        );
      });
  }

  /**
   * Background reconciliation for reconciliation_required outbox documents.
   * Creates local message records without resending to Meta.
   */
  static async reconcilePendingMessages(): Promise<number> {
    const dbAdmin = appwriteAdmin();
    const { data: pending } = await dbAdmin
      .from(APPWRITE_CONFIG.collections.outboundOutbox)
      .select('*')
      .eq('status', 'reconciliation_required')
      .limit(20);

    if (!pending || !Array.isArray(pending) || pending.length === 0) {
      return 0;
    }

    let reconciledCount = 0;
    for (const doc of pending as Record<string, unknown>[]) {
      const docId = String(doc.$id || doc.id || '');
      const accountId = String(doc.accountId || '');
      const conversationId = String(doc.conversationId || '');
      const providerMessageId = String(doc.providerMessageId || '');

      if (!docId || !accountId || !conversationId || !providerMessageId) {
        continue;
      }

      try {
        // Check if message already exists
        const { data: existingMsg } = await dbAdmin
          .from(APPWRITE_CONFIG.collections.messages)
          .select('id')
          .eq('accountId', accountId)
          .eq('messageId', providerMessageId)
          .maybeSingle();

        if (!existingMsg) {
          const now = new Date().toISOString();
          await dbAdmin.from(APPWRITE_CONFIG.collections.messages).insert({
            accountId,
            conversationId,
            senderType: 'agent',
            contentType: 'text',
            contentText: 'Message sent (reconciled)',
            messageId: providerMessageId,
            status: 'sent',
            createdAt: now,
            updatedAt: now,
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
