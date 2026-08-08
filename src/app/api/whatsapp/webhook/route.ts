import { NextResponse, after } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { decrypt } from '@/lib/whatsapp/encryption';
import { verifyMetaWebhookSignature } from '@/lib/whatsapp/webhook-signature';
import {
  handleTemplateWebhookChange,
  isTemplateWebhookField,
} from '@/lib/whatsapp/template-webhook';
import { handleWebhookGet } from './verify-request';
import { handleStatusUpdate } from './process-status';
import { processMessage } from './process-message';
import type { WhatsAppWebhookEntry } from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _adminClient: any = null;
function supabaseAdmin() {
  if (!_adminClient) {
    _adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _adminClient;
}

// GET - Meta challenge verification
export async function GET(request: Request) {
  return handleWebhookGet(request);
}

// POST - Receive webhook events with strict fail-closed signature verification
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-hub-signature-256');

  if (!verifyMetaWebhookSignature(rawBody, signature)) {
    return NextResponse.json(
      { error: 'Invalid webhook signature' },
      { status: 401 }
    );
  }

  let body: { entry?: WhatsAppWebhookEntry[] };
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  try {
    after(async () => {
      try {
        await processWebhook(body);
      } catch (error) {
        console.error('Error processing webhook:', error);
      }
    });
  } catch {
    // When invoked outside Next.js request lifecycle (e.g. in unit tests), execute directly
    void processWebhook(body).catch((error) => {
      console.error('Error processing webhook:', error);
    });
  }

  return NextResponse.json({ status: 'received' }, { status: 200 });
}

async function processWebhook(body: { entry?: WhatsAppWebhookEntry[] }) {
  if (!body.entry) return;

  for (const entry of body.entry) {
    for (const change of entry.changes) {
      if (isTemplateWebhookField(change.field)) {
        await handleTemplateWebhookChange(
          { field: change.field, value: change.value as unknown },
          supabaseAdmin()
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

      const phoneNumberId = value.metadata.phone_number_id;

      const { data: configRows, error: configError } = await supabaseAdmin()
        .from('whatsapp_config')
        .select('*')
        .eq('phone_number_id', phoneNumberId);

      if (configError) {
        console.error(
          `Error fetching whatsapp_config for phone_number_id ${phoneNumberId}:`,
          configError
        );
        continue;
      }

      if (!configRows || configRows.length === 0) {
        console.warn(
          `[webhook] Received message for unregistered phone_number_id: ${phoneNumberId}`
        );
        continue;
      }

      const config = configRows[0];

      let decryptedAccessToken = '';
      try {
        decryptedAccessToken = decrypt(config.access_token);
      } catch (err: any) {
        console.warn(
          `[webhook] Access token decryption failed for phone_number_id ${phoneNumberId}: ${err?.message || err}. ` +
            `Please re-save your WhatsApp configuration in CRM Settings → WhatsApp Integration.`
        );
      }

      for (let i = 0; i < value.messages.length; i++) {
        const message = value.messages[i];
        const contact = value.contacts[i] || value.contacts[0];

        await processMessage(
          message,
          contact,
          config.account_id,
          config.user_id,
          decryptedAccessToken
        );
      }
    }
  }
}
