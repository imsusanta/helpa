import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/server';
import { verifyMetaWebhookSignature } from '@/lib/whatsapp/webhook-signature';
import {
  handleTemplateWebhookChange,
  isTemplateWebhookField,
} from '@/lib/whatsapp/template-webhook';
import { resolveTenantByPhoneNumberId } from '@/core/whatsapp';
import {
  getOrCreateCorrelationId,
  CORRELATION_ID_HEADER,
} from '@/lib/observability/trace-context';
import { logger } from '@/lib/observability/logger';
import { handleWebhookGet } from './verify-request';
import { handleStatusUpdate } from './process-status';
import { processMessage } from './process-message';
import {
  beginInboundEvent,
  completeInboundEvent,
  failInboundEvent,
} from './inbound-event-log';
import type { WhatsAppWebhookEntry } from './types';

/**
 * Outcome of a single webhook POST.
 *
 * `failed` counts messages we could not persist. Only a non-zero `failed`
 * warrants a non-2xx response, because Meta retries the *entire* payload:
 * returning 500 for an event that can never succeed (e.g. an unroutable
 * phone_number_id) produces an unbounded retry storm and can get the whole
 * webhook subscription disabled — taking every tenant's inbound messages
 * down with it.
 */
interface WebhookResult {
  received: number;
  persisted: number;
  duplicates: number;
  skipped: number;
  failed: number;
}

export async function GET(request: Request) {
  return handleWebhookGet(request);
}

export async function POST(request: Request) {
  const correlationId = getOrCreateCorrelationId(request);
  const rawBody = await request.text();
  const signature = request.headers.get('x-hub-signature-256');

  if (!verifyMetaWebhookSignature(rawBody, signature)) {
    logger.warn('Rejected webhook with invalid signature', {
      correlationId,
      component: 'whatsapp-webhook',
      hasSignature: Boolean(signature),
    });
    return NextResponse.json(
      { error: 'Invalid webhook signature' },
      {
        status: 401,
        headers: {
          'Cache-Control': 'private, no-store, no-cache, must-revalidate',
          [CORRELATION_ID_HEADER]: correlationId,
        },
      }
    );
  }

  let body: { entry?: WhatsAppWebhookEntry[] };
  try {
    body = JSON.parse(rawBody);
  } catch {
    logger.warn('Rejected webhook with unparseable JSON body', {
      correlationId,
      component: 'whatsapp-webhook',
    });
    return NextResponse.json(
      { error: 'Invalid JSON' },
      { status: 400, headers: { [CORRELATION_ID_HEADER]: correlationId } }
    );
  }

  let result: WebhookResult;
  try {
    result = await processWebhook(body, correlationId);
  } catch (err) {
    // Reached only on an unexpected fault outside per-message handling
    // (e.g. the admin client cannot be constructed). A retry may succeed.
    logger.error('Webhook processing aborted', {
      correlationId,
      component: 'whatsapp-webhook',
      error: err instanceof Error ? err.message : 'unknown',
    });
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      {
        status: 500,
        headers: {
          'Cache-Control': 'private, no-store, no-cache, must-revalidate',
          'Retry-After': '5',
          [CORRELATION_ID_HEADER]: correlationId,
        },
      }
    );
  }

  // Ask Meta to redeliver only when a message genuinely failed to persist
  // and a retry has a chance of succeeding.
  if (result.failed > 0) {
    logger.error('Webhook completed with unpersisted inbound messages', {
      correlationId,
      component: 'whatsapp-webhook',
      ...result,
    });
    return NextResponse.json(
      { status: 'partial', ...result },
      {
        status: 500,
        headers: {
          'Cache-Control': 'private, no-store, no-cache, must-revalidate',
          'Retry-After': '5',
          [CORRELATION_ID_HEADER]: correlationId,
        },
      }
    );
  }

  return NextResponse.json(
    { status: 'received', ...result },
    { status: 200, headers: { [CORRELATION_ID_HEADER]: correlationId } }
  );
}

async function processWebhook(
  body: { entry?: WhatsAppWebhookEntry[] },
  correlationId?: string
): Promise<WebhookResult> {
  const result: WebhookResult = {
    received: 0,
    persisted: 0,
    duplicates: 0,
    skipped: 0,
    failed: 0,
  };

  if (!body.entry || !Array.isArray(body.entry)) return result;
  const db = getAdminClient();

  for (const entry of body.entry) {
    if (!entry?.changes || !Array.isArray(entry.changes)) continue;

    for (const change of entry.changes) {
      if (isTemplateWebhookField(change.field)) {
        try {
          await handleTemplateWebhookChange(
            { field: change.field, value: change.value as unknown },
            db
          );
        } catch (err) {
          // Template status changes are independent of inbound delivery.
          logger.error('Template webhook change failed', {
            correlationId,
            component: 'whatsapp-webhook',
            field: change.field,
            error: err instanceof Error ? err.message : 'unknown',
          });
        }
        continue;
      }

      const value = change.value;

      // Outbound delivery receipts. Isolated per status so one bad receipt
      // cannot interfere with inbound persistence below.
      if (value?.statuses && Array.isArray(value.statuses)) {
        for (const status of value.statuses) {
          try {
            await handleStatusUpdate(status);
          } catch (err) {
            logger.error('Outbound status update failed', {
              correlationId,
              component: 'whatsapp-webhook',
              error: err instanceof Error ? err.message : 'unknown',
            });
          }
        }
      }

      // Provider-reported errors on this change (e.g. media fetch failures).
      if (value?.errors && Array.isArray(value.errors)) {
        for (const providerError of value.errors) {
          logger.error('Provider reported a webhook-level error', {
            correlationId,
            component: 'whatsapp-webhook',
            providerErrorCode: providerError?.code,
            providerErrorTitle: providerError?.title,
          });
        }
      }

      if (
        !value?.messages ||
        !Array.isArray(value.messages) ||
        value.messages.length === 0
      ) {
        continue;
      }

      result.received += value.messages.length;

      const phoneNumberId = value.metadata?.phone_number_id;
      if (!phoneNumberId) {
        result.skipped += value.messages.length;
        logger.error('Inbound change has no phone_number_id; cannot route', {
          correlationId,
          component: 'whatsapp-webhook',
          messageCount: value.messages.length,
        });
        continue;
      }

      let tenantContext: Awaited<
        ReturnType<typeof resolveTenantByPhoneNumberId>
      > = null;
      try {
        tenantContext = await resolveTenantByPhoneNumberId(phoneNumberId);
      } catch (err) {
        // A lookup fault (unlike an unknown number) is transient — ask for
        // a redelivery rather than silently discarding the reply.
        result.failed += value.messages.length;
        logger.error('Tenant resolution failed for inbound change', {
          correlationId,
          component: 'whatsapp-webhook',
          phoneNumberId,
          error: err instanceof Error ? err.message : 'unknown',
        });
        continue;
      }

      if (!tenantContext) {
        // Unroutable: this phone_number_id belongs to no workspace. Retrying
        // can never change that, so acknowledge and record it loudly instead
        // of triggering an endless Meta retry loop.
        result.skipped += value.messages.length;
        logger.error(
          'Discarded inbound messages for unregistered phone_number_id',
          {
            correlationId,
            component: 'whatsapp-webhook',
            phoneNumberId,
            messageCount: value.messages.length,
            hint: 'No whatsapp_configs row maps this phone_number_id to an account',
          }
        );
        continue;
      }

      await touchConfigHealth(db, phoneNumberId);

      for (let i = 0; i < value.messages.length; i++) {
        const message = value.messages[i];
        const rawContact =
          (value.contacts && (value.contacts[i] || value.contacts[0])) || null;
        const contact = rawContact || {
          wa_id: message.from,
          profile: { name: message.from },
        };

        // Surface per-message provider errors (e.g. undownloadable media)
        // but still persist whatever content did arrive.
        if (message?.errors && Array.isArray(message.errors)) {
          for (const messageError of message.errors) {
            logger.warn('Provider reported an error on an inbound message', {
              correlationId,
              component: 'whatsapp-webhook',
              accountId: tenantContext.tenantId,
              messageId: message.id,
              providerErrorCode: messageError?.code,
              providerErrorTitle: messageError?.title,
            });
          }
        }

        if (message?.id) {
          const decision = await beginInboundEvent({
            db,
            eventId: message.id,
            accountId: tenantContext.tenantId,
            entryId: entry.id,
            field: change.field,
            payload: message,
            correlationId,
          });

          if (decision === 'skip_duplicate') {
            result.duplicates += 1;
            continue;
          }
        }

        try {
          await processMessage(
            message,
            contact,
            tenantContext.tenantId,
            tenantContext.userId,
            tenantContext.accessToken,
            correlationId
          );

          result.persisted += 1;

          if (message?.id) {
            await completeInboundEvent(db, message.id, correlationId);
          }
        } catch (msgErr) {
          // Isolate the failure: a sibling message in the same batch must
          // still be delivered to the inbox. Previously one bad message
          // aborted the whole batch and every message in it was lost.
          result.failed += 1;
          const reason =
            msgErr instanceof Error ? msgErr.message : 'Unknown failure';

          logger.error('Inbound message persistence failed', {
            correlationId,
            component: 'whatsapp-webhook',
            accountId: tenantContext.tenantId,
            phoneNumberId,
            messageId: message?.id,
            messageType: message?.type,
            error: reason,
          });

          if (message?.id) {
            await failInboundEvent(db, message.id, reason, correlationId);
          }
        }
      }
    }
  }

  logger.info('Inbound webhook batch processed', {
    correlationId,
    component: 'whatsapp-webhook',
    ...result,
  });

  return result;
}

/**
 * Record webhook liveness on the tenant's config row. Purely diagnostic —
 * never allowed to affect inbound persistence.
 */
async function touchConfigHealth(
  db: ReturnType<typeof getAdminClient>,
  phoneNumberId: string
): Promise<void> {
  const nowIso = new Date().toISOString();
  try {
    const { error } = await db
      .from('whatsapp_configs')
      .update({ last_webhook_at: nowIso, updated_at: nowIso })
      .eq('phone_number_id', phoneNumberId);

    if (error) {
      await db
        .from('whatsapp_config')
        .update({ last_webhook_at: nowIso })
        .eq('phone_number_id', phoneNumberId);
    }
  } catch {
    // Health timestamp is non-critical to inbound persistence.
  }
}
