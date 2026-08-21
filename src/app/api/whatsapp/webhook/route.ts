import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/server';
import { verifyMetaWebhookSignature } from '@/lib/whatsapp/webhook-signature';
import {
  handleTemplateWebhookChange,
  isTemplateWebhookField,
} from '@/lib/whatsapp/template-webhook';
import { resolveTenantByPhoneNumberId } from '@/core/whatsapp';
import { handleWebhookGet } from './verify-request';
import { handleStatusUpdate } from './process-status';
import { processMessage } from './process-message';
import type { WhatsAppWebhookEntry } from './types';

export async function GET(request: Request) {
  return handleWebhookGet(request);
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-hub-signature-256');

  if (!verifyMetaWebhookSignature(rawBody, signature)) {
    return NextResponse.json(
      { error: 'Invalid webhook signature' },
      {
        status: 401,
        headers: {
          'Cache-Control': 'private, no-store, no-cache, must-revalidate',
        },
      }
    );
  }

  let body: { entry?: WhatsAppWebhookEntry[] };
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  try {
    await processWebhook(body);
  } catch (error: unknown) {
    console.error(
      'Error processing webhook:',
      error instanceof Error ? error.message : 'Unknown error'
    );
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      {
        status: 500,
        headers: {
          'Cache-Control': 'private, no-store, no-cache, must-revalidate',
          'Retry-After': '5',
        },
      }
    );
  }

  return NextResponse.json({ status: 'received' }, { status: 200 });
}

async function processWebhook(body: { entry?: WhatsAppWebhookEntry[] }) {
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

      if (!value.messages || !value.contacts) continue;

      const phoneNumberId = value.metadata?.phone_number_id;
      if (!phoneNumberId) continue;

      const tenantContext = await resolveTenantByPhoneNumberId(phoneNumberId);
      if (!tenantContext) {
        throw new Error(
          'No WhatsApp configuration found for this phone number'
        );
      }

      await db
        .from('whatsapp_config')
        .update({ last_webhook_at: new Date().toISOString() })
        .eq('phone_number_id', phoneNumberId);

      for (let i = 0; i < value.messages.length; i++) {
        const message = value.messages[i];
        const contact = value.contacts[i] || value.contacts[0];

        await processMessage(
          message,
          contact,
          tenantContext.tenantId,
          tenantContext.userId,
          tenantContext.accessToken
        );
      }
    }
  }
}
