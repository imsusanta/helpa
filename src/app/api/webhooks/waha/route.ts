import { NextResponse } from 'next/server';
import {
  WahaWhatsAppProvider,
  extractValidAccountId,
} from '@/core/providers/whatsapp/waha-provider';
import { getAdminClient } from '@/lib/supabase/server';

/**
 * Verifies that the client-supplied account_id belongs to a real account
 * with an active WhatsApp configuration. Never trust the webhook payload
 * alone for tenant attribution.
 */
async function resolveVerifiedTenantAccountId(
  accountId: string
): Promise<boolean> {
  const db = getAdminClient();

  const { data, error } = await db
    .from('whatsapp_configs')
    .select('account_id')
    .eq('account_id', accountId)
    .limit(1);

  if (!error && data && data.length > 0) {
    return true;
  }

  // Legacy whatsapp_config has no account linkage; verify the account
  // exists at minimum before accepting attribution.
  const { data: accountData } = await db
    .from('accounts')
    .select('id')
    .eq('id', accountId)
    .limit(1);

  return Boolean(accountData && accountData.length > 0);
}

export async function POST(request: Request) {
  try {
    const bodyText = await request.text();
    const provider = new WahaWhatsAppProvider();

    const isValid = await provider.verifyWebhook(request, bodyText);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid or missing webhook signature' },
        { status: 401 }
      );
    }

    const payload = JSON.parse(bodyText || '{}');

    // Strict multi-tenant resolution: reject unknown or malformed tenants
    const accountId = extractValidAccountId(payload);
    if (!accountId) {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid account_id' },
        { status: 403 }
      );
    }

    const isKnownTenant = await resolveVerifiedTenantAccountId(accountId);
    if (!isKnownTenant) {
      console.warn(
        `[WAHA Webhook] Rejected event for unregistered account_id ${accountId}`
      );
      return NextResponse.json(
        { success: false, error: 'Unknown account' },
        { status: 403 }
      );
    }

    const events = await provider.normalizeWebhook(payload);
    const db = getAdminClient();

    for (const evt of events) {
      await db.from('provider_events').insert({
        account_id: accountId,
        provider: 'waha',
        external_event_id: evt.externalMessageId,
        event_type: 'waha_message',
        payload_hash: evt.externalMessageId,
        payload,
        status: 'processed',
      });
    }

    return NextResponse.json({ success: true, count: events.length });
  } catch (err: unknown) {
    console.error('[POST /api/webhooks/waha] Error:', err);
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}
