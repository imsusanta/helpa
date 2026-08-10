import { NextResponse } from 'next/server';
import { WahaWhatsAppProvider } from '@/core/providers/whatsapp/waha-provider';
import { supabaseAdmin, getAdminClient } from '@/lib/appwrite-compat';

export async function POST(request: Request) {
  try {
    const bodyText = await request.text();
    const payload = JSON.parse(bodyText || '{}');

    const provider = new WahaWhatsAppProvider();
    const events = await provider.normalizeWebhook(payload);
    const db = supabaseAdmin();

    for (const evt of events) {
      await db.from('provider_events').insert({
        account_id:
          payload.account_id || '00000000-0000-0000-0000-000000000000',
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
