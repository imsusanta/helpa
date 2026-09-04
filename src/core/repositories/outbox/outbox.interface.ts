/**
 * Helpa Core Platform — WhatsApp Outbox Repository Interface
 *
 * Enforces tenant-scoped outbox persistence, atomic enqueue contracts,
 * and concurrent claim definitions.
 */

import type { TenantContext } from '../tenant-context';
import crypto from 'node:crypto';

export type OutboxJobStatus =
  | 'pending'
  | 'processing'
  | 'retryable'
  | 'retrying'
  | 'sent'
  | 'failed'
  | 'dead_letter'
  | 'cancelled'
  | 'unknown';

export interface EnqueueOutboundMessageInput {
  conversationId: string;
  idempotencyKey: string;
  provider?: string;
  contentType?: string;
  contentText?: string | null;
  senderType?: 'agent' | 'bot';
  mediaUrl?: string | null;
  maxAttempts?: number;
  payload?: Record<string, unknown>;
}

export interface EnqueueOutboundMessageResult {
  ok: boolean;
  duplicate: boolean;
  status: string;
  outboxId?: string;
  messageId?: string;
  providerMessageId?: string;
  error?: string;
  message?: string;
}

export interface ClaimBatchInput {
  workerId: string;
  batchSize?: number;
  leaseSeconds?: number;
}

export interface ClaimedOutboxJob {
  id: string;
  accountId: string;
  conversationId: string;
  messageId: string;
  idempotencyKey: string;
  provider: string;
  attemptCount: number;
  maxAttempts: number;
  payload: Record<string, unknown>;
  contentType: string;
  contentText: string | null;
  mediaUrl: string | null;
  senderType: string;
}

export interface MarkSentInput {
  outboxId: string;
  providerMessageId: string;
  providerResult?: Record<string, unknown>;
}

export interface ScheduleRetryInput {
  outboxId: string;
  retryDelaySeconds: number;
  errorCode?: string;
  errorMessage?: string;
  providerResult?: Record<string, unknown>;
}

export interface MarkDeadLetterInput {
  outboxId: string;
  errorCode?: string;
  errorMessage?: string;
  providerResult?: Record<string, unknown>;
}

export interface IWhatsAppOutboxRepository {
  readonly tenantContext: TenantContext;

  /**
   * Atomically enqueues a message in `messages` and an outbox record in `whatsapp_outbox`
   * within a single database transaction using `enqueue_whatsapp_outbound_message`.
   */
  enqueueOutboundMessage(
    input: EnqueueOutboundMessageInput
  ): Promise<EnqueueOutboundMessageResult>;

  /**
   * Retrieves an outbox job by its ID, scoped strictly to the current tenant.
   */
  getOutboxJobById(outboxId: string): Promise<Record<string, unknown> | null>;

  /**
   * Retrieves an outbox job by idempotency key, scoped strictly to the current tenant.
   */
  getOutboxJobByIdempotencyKey(
    idempotencyKey: string
  ): Promise<Record<string, unknown> | null>;

  /**
   * Marks an outbox record as sent and reconciles the associated message record.
   */
  markSent(input: MarkSentInput): Promise<void>;

  /**
   * Schedules a retry with backoff for a failed outbox job.
   */
  scheduleRetry(input: ScheduleRetryInput): Promise<void>;

  /**
   * Marks an outbox job as dead_letter and updates the associated message to failed.
   */
  markDeadLetter(input: MarkDeadLetterInput): Promise<void>;
}

/**
 * Deterministically generates or formats an idempotency key.
 */
export function generateOutboxIdempotencyKey(params: {
  accountId: string;
  conversationId: string;
  clientKey?: string | null;
  messageType?: string;
  contentText?: string | null;
}): string {
  if (params.clientKey && params.clientKey.trim()) {
    return params.clientKey.trim();
  }
  const hash = crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        accountId: params.accountId,
        conversationId: params.conversationId,
        messageType: params.messageType || 'text',
        contentText: params.contentText || '',
      })
    )
    .digest('hex');
  return `outbox_${params.conversationId}_${hash.slice(0, 16)}`;
}
