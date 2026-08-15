import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/appwrite-server-compat';
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
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error processing webhook:', message);
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

  for (const entry of body.entry) {
    for (const change of entry.changes) {
      if (isTemplateWebhookField(change.field)) {
        await handleTemplateWebhookChange(
          { field: change.field, value: change.value as unknown },
          getAdminClient()
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

      let configRows: Record<string, unknown>[] | null = null;
      try {
        const { data } = await getAdminClient()
          .from('whatsapp_config')
          .select('*')
          .eq('phone_number_id', phoneNumberId);
        if (data && data.length > 0) configRows = data;
      } catch {
        // Fallback
      }

      if (!configRows || configRows.length === 0) {
        try {
          const { data } = await getAdminClient()
            .from('whatsapp_configs')
            .select('*')
            .eq('phone_number_id', phoneNumberId);
          if (data && data.length > 0) configRows = data;
        } catch {
          // Fallback
        }
      }

      if (!configRows || configRows.length === 0) {
        try {
          const { data } = await getAdminClient()
            .from('whatsapp_configs')
            .select('*')
            .eq('phoneNumberId', phoneNumberId);
          if (data && data.length > 0) configRows = data;
        } catch {
          // Fallback
        }
      }

      if (!configRows || configRows.length === 0) {
        try {
          const { data: allConfigs } = await getAdminClient()
            .from('whatsapp_config')
            .select('*')
            .limit(2);
          if (allConfigs && allConfigs.length === 1) {
            configRows = allConfigs;
          }
        } catch {
          // Fallback
        }
      }

      if (!configRows || configRows.length === 0) {
        try {
          const { data: allConfigs } = await getAdminClient()
            .from('whatsapp_configs')
            .select('*')
            .limit(2);
          if (allConfigs && allConfigs.length === 1) {
            configRows = allConfigs;
          }
        } catch {
          // Fallback
        }
      }

      if (!configRows || configRows.length === 0) {
        throw new Error(
          `No WhatsApp configuration found for phone_number_id ${phoneNumberId}`
        );
      }

      const config = configRows[0];
      const encToken = String(
        config.encryptedAccessToken ||
          config.encrypted_access_token ||
          config.accessToken ||
          config.access_token ||
          ''
      );

      let decryptedAccessToken = '';
      if (encToken) {
        try {
          decryptedAccessToken = decrypt(encToken);
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          console.warn(
            `[webhook] Access token decryption failed for phone_number_id ${phoneNumberId}: ${message}. ` +
              `Please re-save your WhatsApp configuration in CRM Settings → WhatsApp Integration.`
          );
        }
      }

      const accountId = String(config.accountId || config.account_id || '');
      const userId = String(config.userId || config.user_id || '');

      for (let i = 0; i < value.messages.length; i++) {
        const message = value.messages[i];
        const contact = value.contacts[i] || value.contacts[0];

        await processMessage(
          message,
          contact,
          accountId,
          userId,
          decryptedAccessToken
        );
      }
    }
  }
}
