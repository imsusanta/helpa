/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SupabaseClient } from '@supabase/supabase-js';
import { getAdminClient } from '@/lib/db/server';
import { assertTenantContext, type TenantContext } from '../tenant-context';
import type {
  ClaimBatchInput,
  ClaimedOutboxJob,
  EnqueueOutboundMessageInput,
  EnqueueOutboundMessageResult,
  IWhatsAppOutboxRepository,
  MarkDeadLetterInput,
  MarkSentInput,
  ScheduleRetryInput,
} from './outbox.interface';

export class SupabaseWhatsAppOutboxRepository implements IWhatsAppOutboxRepository {
  readonly tenantContext: TenantContext;
  private readonly client: SupabaseClient<any, any, any>;

  constructor(
    tenantContext: TenantContext,
    client?: SupabaseClient<any, any, any>
  ) {
    assertTenantContext(tenantContext);
    this.tenantContext = tenantContext;
    this.client =
      client ?? (getAdminClient() as unknown as SupabaseClient<any, any, any>);
  }

  private ensureContext(): string {
    assertTenantContext(this.tenantContext);
    return this.tenantContext.accountId.trim();
  }

  async enqueueOutboundMessage(
    input: EnqueueOutboundMessageInput
  ): Promise<EnqueueOutboundMessageResult> {
    const accountId = this.ensureContext();
    if (!input.conversationId?.trim() || !input.idempotencyKey?.trim()) {
      return {
        ok: false,
        duplicate: false,
        status: 'error',
        error: 'INVALID_PARAMETERS',
        message: 'conversationId and idempotencyKey are required',
      };
    }

    try {
      const { data, error } = await this.client.rpc(
        'enqueue_whatsapp_outbound_message',
        {
          p_account_id: accountId,
          p_conversation_id: input.conversationId.trim(),
          p_idempotency_key: input.idempotencyKey.trim(),
          p_provider: input.provider || 'meta',
          p_content_type: input.contentType || 'text',
          p_content_text: input.contentText ?? null,
          p_sender_type: input.senderType || 'agent',
          p_media_url: input.mediaUrl ?? null,
          p_max_attempts: input.maxAttempts || 8,
          p_payload: input.payload || {},
        }
      );

      if (error) {
        return {
          ok: false,
          duplicate: false,
          status: 'error',
          error: error.code || 'RPC_ERROR',
          message: error.message,
        };
      }

      const res = data as Record<string, unknown>;
      return {
        ok: Boolean(res.ok),
        duplicate: Boolean(res.duplicate),
        status: String(res.status || 'pending'),
        outboxId: res.outbox_id ? String(res.outbox_id) : undefined,
        messageId: res.message_id ? String(res.message_id) : undefined,
        providerMessageId: res.provider_message_id
          ? String(res.provider_message_id)
          : undefined,
        error: res.error ? String(res.error) : undefined,
        message: res.message ? String(res.message) : undefined,
      };
    } catch (err) {
      return {
        ok: false,
        duplicate: false,
        status: 'error',
        error: 'DATABASE_ERROR',
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async getOutboxJobById(
    outboxId: string
  ): Promise<Record<string, unknown> | null> {
    const accountId = this.ensureContext();
    if (!outboxId?.trim()) return null;

    try {
      const { data } = await this.client
        .from('whatsapp_outbox')
        .select('*')
        .eq('id', outboxId.trim())
        .eq('account_id', accountId)
        .maybeSingle();

      return (data as Record<string, unknown>) ?? null;
    } catch {
      return null;
    }
  }

  async getOutboxJobByIdempotencyKey(
    idempotencyKey: string
  ): Promise<Record<string, unknown> | null> {
    const accountId = this.ensureContext();
    if (!idempotencyKey?.trim()) return null;

    try {
      const { data } = await this.client
        .from('whatsapp_outbox')
        .select('*')
        .eq('account_id', accountId)
        .eq('idempotency_key', idempotencyKey.trim())
        .maybeSingle();

      return (data as Record<string, unknown>) ?? null;
    } catch {
      return null;
    }
  }

  async markSent(input: MarkSentInput): Promise<void> {
    const accountId = this.ensureContext();
    const now = new Date().toISOString();

    const { data } = await this.client
      .from('whatsapp_outbox')
      .update({
        status: 'sent',
        provider_message_id: input.providerMessageId,
        provider_result: input.providerResult || {},
        sent_at: now,
        locked_at: null,
        locked_by: null,
        lease_expires_at: null,
        updated_at: now,
      })
      .eq('id', input.outboxId)
      .eq('account_id', accountId)
      .select('message_id')
      .maybeSingle();

    const messageId = data?.message_id;
    if (messageId) {
      await this.client
        .from('messages')
        .update({
          status: 'delivered',
          provider_message_id: input.providerMessageId,
          updated_at: now,
        })
        .eq('id', String(messageId))
        .eq('account_id', accountId);
    }
  }

  async scheduleRetry(input: ScheduleRetryInput): Promise<void> {
    const accountId = this.ensureContext();
    const now = new Date();
    const availableAt = new Date(
      now.getTime() + input.retryDelaySeconds * 1000
    ).toISOString();

    await this.client
      .from('whatsapp_outbox')
      .update({
        status: 'retryable',
        available_at: availableAt,
        last_error_code: input.errorCode || null,
        last_error_message: input.errorMessage || null,
        provider_result: input.providerResult || {},
        locked_at: null,
        locked_by: null,
        lease_expires_at: null,
        updated_at: now.toISOString(),
      })
      .eq('id', input.outboxId)
      .eq('account_id', accountId);
  }

  async markDeadLetter(input: MarkDeadLetterInput): Promise<void> {
    const accountId = this.ensureContext();
    const now = new Date().toISOString();

    const { data } = await this.client
      .from('whatsapp_outbox')
      .update({
        status: 'dead_letter',
        dead_lettered_at: now,
        last_error_code: input.errorCode || null,
        last_error_message: input.errorMessage || null,
        provider_result: input.providerResult || {},
        locked_at: null,
        locked_by: null,
        lease_expires_at: null,
        updated_at: now,
      })
      .eq('id', input.outboxId)
      .eq('account_id', accountId)
      .select('message_id')
      .maybeSingle();

    const messageId = data?.message_id;
    if (messageId) {
      await this.client
        .from('messages')
        .update({
          status: 'failed',
          updated_at: now,
        })
        .eq('id', String(messageId))
        .eq('account_id', accountId);
    }
  }

  /**
   * System-level atomic batch claiming method using `claim_whatsapp_outbox_batch` RPC.
   * Utilizes FOR UPDATE SKIP LOCKED with lease duration to prevent concurrent worker collisions.
   */
  static async claimOutboxBatch(
    client: SupabaseClient<any, any, any>,
    input: ClaimBatchInput
  ): Promise<ClaimedOutboxJob[]> {
    try {
      const { data, error } = await client.rpc('claim_whatsapp_outbox_batch', {
        p_worker_id: input.workerId,
        p_batch_size: input.batchSize || 20,
        p_lease_seconds: input.leaseSeconds || 120,
      });

      if (error || !Array.isArray(data)) {
        if (error) {
          console.error(
            '[SupabaseWhatsAppOutboxRepository] claim_whatsapp_outbox_batch failed:',
            error
          );
        }
        return [];
      }

      return data.map((row: any) => ({
        id: String(row.id),
        accountId: String(row.account_id),
        conversationId: String(row.conversation_id),
        messageId: String(row.message_id),
        idempotencyKey: String(row.idempotency_key),
        provider: String(row.provider || 'meta'),
        attemptCount: Number(row.attempt_count || 0),
        maxAttempts: Number(row.max_attempts || 8),
        payload: (row.payload as Record<string, unknown>) || {},
        contentType: String(row.content_type || 'text'),
        contentText: row.content_text ? String(row.content_text) : null,
        mediaUrl: row.media_url ? String(row.media_url) : null,
        senderType: String(row.sender_type || 'agent'),
      }));
    } catch (err) {
      console.error(
        '[SupabaseWhatsAppOutboxRepository] claimOutboxBatch exception:',
        err
      );
      return [];
    }
  }
}
