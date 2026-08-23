import crypto from 'node:crypto';
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
import { handleWebhookGet } from './verify-request';
import { handleStatusUpdate } from './process-status';
import { processMessage } from './process-message';
import type { WhatsAppWebhookEntry } from './types';

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: string; message?: string };
  return (
    candidate.code === '23505' ||
    candidate.message?.toLowerCase().includes('duplicate key') === true
  );
}

export async function GET(request: Request) {
  return handleWebhookGet(request);
}

export async function POST(request: Request) {
  const correlationId = getOrCreateCorrelationId(request);
  const rawBody = await request.text();
  const signature = request.headers.get('x-hub-signature-256');

  if (!verifyMetaWebhookSignature(rawBody, signature)) {
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
    return NextResponse.json(
      { error: 'Invalid JSON' },
      { status: 400, headers: { [CORRELATION_ID_HEADER]: correlationId } }
    );
  }

  try {
    await processWebhook(body, correlationId);
  } catch {
    console.error('[Webhook] Error processing inbound event');
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

  return NextResponse.json(
    { status: 'received' },
    { status: 200, headers: { [CORRELATION_ID_HEADER]: correlationId } }
  );
}

async function processWebhook(
  body: { entry?: WhatsAppWebhookEntry[] },
  correlationId?: string
) {
  if (!body.entry) return;
  const db = getAdminClient();

  for (const entry of body.entry) {
    for (const change of entry.changes) {
      if (isTemplateWebhookField(change.field)) {
        await handleTemplateWebhookChange(
          { field: change.field, value: change.value as unknown },
          db
        );
        continue;
      }

      const value = change.value;

      if (value.statuses) {
        for (const status of value.statuses) {
          await handleStatusUpdate(status);
        }
      }

      if (
        !value.messages ||
        !Array.isArray(value.messages) ||
        value.messages.length === 0
      ) {
        continue;
      }

      const phoneNumberId = value.metadata?.phone_number_id;
      if (!phoneNumberId) continue;

      const tenantContext = await resolveTenantByPhoneNumberId(phoneNumberId);
      if (!tenantContext) {
        throw new Error('No WhatsApp configuration found for phone number');
      }

      const nowIso = new Date().toISOString();
      try {
        const { error: confErr } = await db
          .from('whatsapp_configs')
          .update({ last_webhook_at: nowIso, updated_at: nowIso })
          .eq('phone_number_id', phoneNumberId);

        if (confErr) {
          await db
            .from('whatsapp_config')
            .update({ last_webhook_at: nowIso })
            .eq('phone_number_id', phoneNumberId);
        }
      } catch {
        // Health timestamp is non-critical to inbound persistence.
      }

      for (let i = 0; i < value.messages.length; i++) {
        const message = value.messages[i];
        const rawContact =
          (value.contacts && (value.contacts[i] || value.contacts[0])) || null;
        const contact = rawContact || {
          wa_id: message.from,
          profile: { name: message.from },
        };

        if (message?.id) {
          const payloadHash = crypto
            .createHash('sha256')
            .update(JSON.stringify(message))
            .digest('hex');

          const { error: eventInsertError } = await db
            .from('webhook_events')
            .insert({
              account_id: tenantContext.tenantId,
              provider: 'whatsapp',
              provider_event_id: message.id,
              status: 'processing',
              payload_hash: payloadHash,
              attempt_count: 1,
              received_at: nowIso,
            });

          if (eventInsertError) {
            if (isUniqueViolation(eventInsertError)) {
              console.warn('[Webhook Idempotency] Duplicate event skipped');
              continue;
            }

            console.error('[Webhook Idempotency] Event registration failed');
            throw new Error('Unable to register inbound webhook event');
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

          if (message?.id) {
            const { error: processedUpdateError } = await db
              .from('webhook_events')
              .update({
                status: 'processed',
                processed_at: new Date().toISOString(),
              })
              .eq('provider', 'whatsapp')
              .eq('provider_event_id', message.id);

            if (processedUpdateError) {
              console.error(
                '[Webhook Idempotency] Processed status update failed'
              );
            }
          }
        } catch (msgErr) {
          console.error('[Webhook] Inbound message processing failed');
          if (message?.id) {
            await db
              .from('webhook_events')
              .update({
                status: 'retrying',
                processed_at: new Date().toISOString(),
              })
              .eq('provider', 'whatsapp')
              .eq('provider_event_id', message.id);
          }
          throw msgErr;
        }
      }
    }
  }
}
