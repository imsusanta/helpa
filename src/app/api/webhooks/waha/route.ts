import { NextResponse } from 'next/server';
import { WahaWhatsAppProvider } from '@/core/providers/whatsapp/waha-provider';
import { appwriteAdmin } from '@/lib/appwrite-server-compat';

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
    const events = await provider.normalizeWebhook(payload);
    const db = appwriteAdmin();

    for (const evt of events) {
      await db.from('provider_events').insert({
        account_id:
          (payload.account_id as string) ||
          '00000000-0000-0000-0000-000000000000',
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
