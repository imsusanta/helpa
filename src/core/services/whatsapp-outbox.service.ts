/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Helpa Core Platform — WhatsApp Outbox Service
 *
 * Provides transactional outbox lifecycle management:
 * - Atomic local enqueue
 * - Concurrent claim execution (FOR UPDATE SKIP LOCKED)
 * - Deterministic backoff with bounded jitter
 * - Domain error classification (retryable vs terminal)
 * - Synchronous-compatible enqueue & dispatch
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getAdminClient } from '@/lib/db/server';
import {
  SupabaseWhatsAppOutboxRepository,
  type EnqueueOutboundMessageInput,
  type EnqueueOutboundMessageResult,
} from '@/core/repositories/outbox';
import {
  sendTextMessage,
  sendTemplateMessage,
  sendMediaMessage,
  type MediaKind,
} from '@/lib/whatsapp/meta-api';
import { decrypt } from '@/lib/whatsapp/encryption';
import { sanitizePhoneForMeta } from '@/lib/whatsapp/phone-utils';
import { EvolutionGoProvider } from '@/core/providers/whatsapp/evolution-go-provider';
import { WahaWhatsAppProvider } from '@/core/providers/whatsapp/waha-provider';
import {
  touchConversationPreview,
  outboundPreviewText,
} from '@/lib/whatsapp/persist-outbound-message';

// ── Backoff & Retry Policies ───────────────────────────────────

export const BACKOFF_SCHEDULE_SECONDS = [
  30, // Attempt 1: 30s
  120, // Attempt 2: 2m
  300, // Attempt 3: 5m
  900, // Attempt 4: 15m
  3600, // Attempt 5: 1h
  14400, // Attempt 6: 4h
  43200, // Attempt 7+: 12h
] as const;

export const DEFAULT_MAX_ATTEMPTS = 8;

export interface BackoffOptions {
  jitterRatio?: number; // Default: 0.2 (+-10%)
  randomFn?: () => number;
}

/**
 * Calculates exponential backoff in seconds for a given attempt count with bounded jitter.
 */
export function calculateOutboxBackoff(
  attemptCount: number,
  options: BackoffOptions = {}
): number {
  const index = Math.max(
    0,
    Math.min(attemptCount - 1, BACKOFF_SCHEDULE_SECONDS.length - 1)
  );
  const baseSeconds = BACKOFF_SCHEDULE_SECONDS[index];
  const jitterRatio = options.jitterRatio ?? 0.2;
  const rand = options.randomFn ? options.randomFn() : Math.random();

  // Jitter between [1 - jitterRatio/2, 1 + jitterRatio/2]
  const multiplier = 1 - jitterRatio / 2 + rand * jitterRatio;
  return Math.max(5, Math.round(baseSeconds * multiplier));
}

// ── Error Classification ───────────────────────────────────────

export interface ClassifiedOutboxError {
  isRetryable: boolean;
  errorCode: string;
  errorMessage: string;
}

export function classifyOutboxError(error: unknown): ClassifiedOutboxError {
  if (!error) {
    return {
      isRetryable: false,
      errorCode: 'UNKNOWN_ERROR',
      errorMessage: 'Unknown error',
    };
  }

  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message: unknown }).message)
        : String(error);

  let code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code: unknown }).code)
      : '';

  if (!code) {
    const codeMatch = message.match(/\(#(\d+)\)/);
    if (codeMatch) code = codeMatch[1];
  }

  const lower = message.toLowerCase();

  // 1. Permanent Failures (Invalid numbers, auth revoke, bad templates, bad payloads)
  if (
    lower.includes('not a valid whatsapp user') ||
    lower.includes('invalid phone') ||
    lower.includes('not in allowed list') ||
    lower.includes('recipient phone number not in allowed list') ||
    code === '131026' ||
    code === '131030'
  ) {
    return {
      isRetryable: false,
      errorCode: code || 'INVALID_RECIPIENT',
      errorMessage: message,
    };
  }

  if (
    lower.includes('template does not exist') ||
    lower.includes('template not found') ||
    lower.includes('parameter count mismatch') ||
    lower.includes('template malformed') ||
    code === '132000' ||
    code === '132001'
  ) {
    return {
      isRetryable: false,
      errorCode: code || 'INVALID_TEMPLATE',
      errorMessage: message,
    };
  }

  if (
    lower.includes('access token') ||
    lower.includes('session has expired') ||
    lower.includes('authentication failed') ||
    code === '190'
  ) {
    return {
      isRetryable: false,
      errorCode: code || 'AUTH_FAILURE',
      errorMessage: message,
    };
  }

  // 2. Retryable Failures (Rate limits, timeouts, server errors, network reset)
  if (
    lower.includes('rate limit') ||
    lower.includes('too many requests') ||
    lower.includes('user request limit reached') ||
    code === '429' ||
    code === '130429' ||
    code === '131056' ||
    code === '131057'
  ) {
    return {
      isRetryable: true,
      errorCode: code || 'RATE_LIMITED',
      errorMessage: message,
    };
  }

  if (
    lower.includes('timeout') ||
    lower.includes('etimedout') ||
    lower.includes('econnreset') ||
    lower.includes('fetch failed') ||
    lower.includes('network error') ||
    lower.includes('service unavailable') ||
    lower.includes('502') ||
    lower.includes('503') ||
    lower.includes('504') ||
    code === 'ETIMEDOUT' ||
    code === 'ECONNRESET' ||
    code === '502' ||
    code === '503' ||
    code === '504'
  ) {
    return {
      isRetryable: true,
      errorCode: code || 'NETWORK_RETRYABLE',
      errorMessage: message,
    };
  }

  // Default: unclassified errors are marked non-retryable to avoid infinite loops on unexpected shapes
  return {
    isRetryable: false,
    errorCode: code || 'UNCLASSIFIED_ERROR',
    errorMessage: message,
  };
}

// ── Outbox Service Implementation ──────────────────────────────

export interface EnqueueAndProcessInput {
  accountId: string;
  conversationId: string;
  contactPhone: string;
  idempotencyKey: string;
  messageType: string;
  contentText?: string | null;
  mediaUrl?: string | null;
  filename?: string | null;
  templateName?: string | null;
  templateLanguage?: string | null;
  templateParams?: unknown[];
  replyToMessageId?: string | null;
  senderId?: string | null;
  senderType?: 'agent' | 'bot';
  provider?: string;
  maxAttempts?: number;
}

export interface EnqueueAndProcessResult {
  success: boolean;
  status: string;
  messageId?: string;
  outboxId?: string;
  id?: string;
  conversationId?: string;
  phone?: string;
  error?: string;
  retryable?: boolean;
}

export class WhatsAppOutboxService {
  constructor(private readonly client?: SupabaseClient<any, any, any>) {}

  private getClient(): SupabaseClient<any, any, any> {
    return (
      this.client ??
      (getAdminClient() as unknown as SupabaseClient<any, any, any>)
    );
  }

  /**
   * Atomically enqueues a message in `messages` and an outbox record in `whatsapp_outbox`.
   */
  async enqueue(
    accountId: string,
    input: EnqueueOutboundMessageInput
  ): Promise<EnqueueOutboundMessageResult> {
    const repo = new SupabaseWhatsAppOutboxRepository(
      { accountId },
      this.getClient()
    );
    return repo.enqueueOutboundMessage(input);
  }

  /**
   * Executes atomic enqueue and immediately attempts delivery.
   * Preserves synchronous compatibility with `/api/whatsapp/send` while ensuring
   * atomic database persistence and crash resilience.
   */
  async enqueueAndProcess(
    input: EnqueueAndProcessInput
  ): Promise<EnqueueAndProcessResult> {
    const client = this.getClient();
    const repo = new SupabaseWhatsAppOutboxRepository(
      { accountId: input.accountId },
      client
    );

    // 1. Atomic local enqueue in PostgreSQL
    const enqueueRes = await repo.enqueueOutboundMessage({
      conversationId: input.conversationId,
      idempotencyKey: input.idempotencyKey,
      provider: input.provider || 'meta',
      contentType: input.messageType,
      contentText: input.contentText,
      senderType: input.senderType || 'agent',
      mediaUrl: input.mediaUrl,
      maxAttempts: input.maxAttempts || DEFAULT_MAX_ATTEMPTS,
      payload: {
        contactPhone: input.contactPhone,
        templateName: input.templateName || null,
        templateLanguage: input.templateLanguage || null,
        templateParams: input.templateParams || null,
        replyToMessageId: input.replyToMessageId || null,
        senderId: input.senderId || null,
      },
    });

    if (!enqueueRes.ok) {
      return {
        success: false,
        status: 'error',
        error: enqueueRes.error || enqueueRes.message || 'ENQUEUE_FAILED',
        retryable: false,
      };
    }

    // 2. Handle duplicates idempotently
    if (enqueueRes.duplicate) {
      if (enqueueRes.status === 'sent') {
        return {
          success: true,
          status: 'sent',
          messageId: enqueueRes.providerMessageId || enqueueRes.messageId,
          outboxId: enqueueRes.outboxId,
          id: enqueueRes.messageId,
          conversationId: input.conversationId,
          phone: input.contactPhone,
        };
      }
      return {
        success: false,
        status: enqueueRes.status,
        error: 'DUPLICATE_REQUEST_IN_PROGRESS',
        outboxId: enqueueRes.outboxId,
        messageId: enqueueRes.messageId,
      };
    }

    const outboxId = enqueueRes.outboxId!;
    const messageId = enqueueRes.messageId!;

    // 3. Dispatch to WhatsApp provider outside DB transaction
    try {
      const waMessageId = await this.dispatchToProvider({
        accountId: input.accountId,
        contactPhone: input.contactPhone,
        messageType: input.messageType,
        contentText: input.contentText,
        mediaUrl: input.mediaUrl,
        filename: input.filename,
        templateName: input.templateName,
        templateLanguage: input.templateLanguage,
        templateParams: input.templateParams,
        replyToMessageId: input.replyToMessageId,
        provider: input.provider,
      });

      // 4. Mark sent & reconcile
      await repo.markSent({
        outboxId,
        providerMessageId: waMessageId,
      });

      // 5. Update conversation preview
      try {
        await touchConversationPreview({
          accountId: input.accountId,
          conversationId: input.conversationId,
          previewText: outboundPreviewText({
            contentText: input.contentText,
            contentType: input.messageType,
          }),
        });
      } catch (err) {
        console.warn(
          '[WhatsAppOutboxService] touchConversationPreview failed:',
          err
        );
      }

      return {
        success: true,
        status: 'sent',
        messageId: waMessageId,
        outboxId,
        id: messageId,
        conversationId: input.conversationId,
        phone: input.contactPhone,
      };
    } catch (dispatchErr) {
      const classified = classifyOutboxError(dispatchErr);

      if (classified.isRetryable) {
        const delaySeconds = calculateOutboxBackoff(1);
        await repo.scheduleRetry({
          outboxId,
          retryDelaySeconds: delaySeconds,
          errorCode: classified.errorCode,
          errorMessage: classified.errorMessage,
        });
      } else {
        await repo.markDeadLetter({
          outboxId,
          errorCode: classified.errorCode,
          errorMessage: classified.errorMessage,
        });
      }

      return {
        success: false,
        status: classified.isRetryable ? 'retryable' : 'dead_letter',
        error: classified.errorMessage,
        outboxId,
        id: messageId,
        retryable: classified.isRetryable,
      };
    }
  }

  /**
   * Background batch worker claim and execution.
   * Claims ready jobs using `FOR UPDATE SKIP LOCKED` and dispatches each job.
   */
  async claimAndProcessBatch(params: {
    workerId: string;
    batchSize?: number;
    leaseDurationSeconds?: number;
  }): Promise<{
    claimed: number;
    succeeded: number;
    retried: number;
    failed: number;
  }> {
    const client = this.getClient();
    const jobs = await SupabaseWhatsAppOutboxRepository.claimOutboxBatch(
      client,
      {
        workerId: params.workerId,
        batchSize: params.batchSize || 20,
        leaseSeconds: params.leaseDurationSeconds || 120,
      }
    );

    let succeeded = 0;
    let retried = 0;
    let failed = 0;

    for (const job of jobs) {
      const repo = new SupabaseWhatsAppOutboxRepository(
        { accountId: job.accountId },
        client
      );

      try {
        const payload = job.payload || {};
        const contactPhone =
          String(payload.contactPhone || '') ||
          (await this.resolveContactPhone(job.accountId, job.conversationId));

        if (!contactPhone) {
          throw new Error('Could not resolve phone number for outbox job');
        }

        const waMessageId = await this.dispatchToProvider({
          accountId: job.accountId,
          contactPhone,
          messageType: job.contentType,
          contentText: job.contentText,
          mediaUrl: job.mediaUrl,
          templateName: payload.templateName as string | undefined,
          templateLanguage: payload.templateLanguage as string | undefined,
          templateParams: payload.templateParams as unknown[] | undefined,
          replyToMessageId: payload.replyToMessageId as string | undefined,
          provider: job.provider,
        });

        await repo.markSent({
          outboxId: job.id,
          providerMessageId: waMessageId,
        });

        try {
          await touchConversationPreview({
            accountId: job.accountId,
            conversationId: job.conversationId,
            previewText: outboundPreviewText({
              contentText: job.contentText,
              contentType: job.contentType,
            }),
          });
        } catch {}

        succeeded++;
      } catch (err) {
        const classified = classifyOutboxError(err);
        const nextAttempt = job.attemptCount;

        if (classified.isRetryable && nextAttempt < job.maxAttempts) {
          const delaySeconds = calculateOutboxBackoff(nextAttempt);
          await repo.scheduleRetry({
            outboxId: job.id,
            retryDelaySeconds: delaySeconds,
            errorCode: classified.errorCode,
            errorMessage: classified.errorMessage,
          });
          retried++;
        } else {
          await repo.markDeadLetter({
            outboxId: job.id,
            errorCode: classified.errorCode,
            errorMessage: classified.errorMessage,
          });
          failed++;
        }
      }
    }

    return {
      claimed: jobs.length,
      succeeded,
      retried,
      failed,
    };
  }

  // ── Private Provider Dispatch Helpers ─────────────────────────

  private async dispatchToProvider(params: {
    accountId: string;
    contactPhone: string;
    messageType: string;
    contentText?: string | null;
    mediaUrl?: string | null;
    filename?: string | null;
    templateName?: string | null;
    templateLanguage?: string | null;
    templateParams?: unknown[];
    replyToMessageId?: string | null;
    provider?: string;
  }): Promise<string> {
    const config = await this.loadTenantConfig(params.accountId);
    if (!config) {
      throw new Error(
        `WhatsApp configuration missing for tenant ${params.accountId}`
      );
    }

    const providerKind = params.provider || config.provider || 'meta';

    if (providerKind === 'evolution' || providerKind === 'waha') {
      const outboundProvider =
        providerKind === 'evolution'
          ? new EvolutionGoProvider({
              accountId: params.accountId,
              instanceToken: config.accessToken,
            })
          : new WahaWhatsAppProvider();

      if (params.messageType === 'template') {
        const res = await outboundProvider.sendTemplate(
          params.accountId,
          params.contactPhone,
          params.templateName || '',
          params.templateLanguage || 'en_US',
          params.templateParams || []
        );
        return res.externalMessageId;
      }
      if (params.messageType === 'text') {
        const res = await outboundProvider.sendText(
          params.accountId,
          params.contactPhone,
          params.contentText || ''
        );
        return res.externalMessageId;
      }
      const res = await outboundProvider.sendMedia(
        params.accountId,
        params.contactPhone,
        params.mediaUrl || '',
        params.messageType as MediaKind,
        params.contentText || undefined
      );
      return res.externalMessageId;
    }

    // Default Meta Cloud API
    if (!config.phoneNumberId || !config.accessToken) {
      throw new Error('Meta WhatsApp credentials incomplete');
    }

    if (params.messageType === 'text') {
      const res = await sendTextMessage({
        phoneNumberId: config.phoneNumberId,
        accessToken: config.accessToken,
        to: params.contactPhone,
        text: params.contentText || '',
        contextMessageId: params.replyToMessageId || undefined,
      });
      return res.messageId;
    }

    if (params.messageType === 'template') {
      const stringParams = Array.isArray(params.templateParams)
        ? params.templateParams.map((p) => String(p))
        : [];
      const res = await sendTemplateMessage({
        phoneNumberId: config.phoneNumberId,
        accessToken: config.accessToken,
        to: params.contactPhone,
        templateName: params.templateName || '',
        language: params.templateLanguage || 'en_US',
        params: stringParams,
      });
      return res.messageId;
    }

    const res = await sendMediaMessage({
      phoneNumberId: config.phoneNumberId,
      accessToken: config.accessToken,
      to: params.contactPhone,
      kind: params.messageType as MediaKind,
      link: params.mediaUrl || '',
      caption: params.contentText || undefined,
      filename: params.filename || undefined,
    });
    return res.messageId;
  }

  private async loadTenantConfig(accountId: string): Promise<{
    phoneNumberId: string;
    accessToken: string;
    provider?: string;
  } | null> {
    const client = this.getClient();
    try {
      const { data } = await client
        .from('whatsapp_configs')
        .select('*')
        .eq('account_id', accountId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!data) return null;

      const encrypted =
        data.encrypted_access_token ||
        data.access_token_encrypted ||
        data.access_token ||
        '';

      const decrypted = encrypted ? decrypt(encrypted) : '';
      return {
        phoneNumberId: String(data.phone_number_id || ''),
        accessToken: decrypted,
        provider: data.provider ? String(data.provider) : undefined,
      };
    } catch {
      return null;
    }
  }

  private async resolveContactPhone(
    accountId: string,
    conversationId: string
  ): Promise<string | null> {
    const client = this.getClient();
    try {
      const { data } = await client
        .from('conversations')
        .select('*, contact:contacts(*)')
        .eq('id', conversationId)
        .eq('account_id', accountId)
        .maybeSingle();

      const phone =
        (data?.contact as { phone?: string })?.phone ||
        data?.contact_phone ||
        data?.phone;

      if (phone) {
        return sanitizePhoneForMeta(String(phone));
      }
      return null;
    } catch {
      return null;
    }
  }
}

export const whatsappOutboxService = new WhatsAppOutboxService();
