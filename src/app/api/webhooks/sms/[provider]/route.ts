import { NextResponse } from 'next/server';
import { TwilioSmsProvider } from '@/core/providers/sms/twilio-provider';
import { ExotelSmsProvider } from '@/core/providers/sms/exotel-provider';
import { appwriteAdmin } from '@/lib/appwrite-compat';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider: providerName } = await params;
  if (!['twilio', 'exotel'].includes(providerName)) {
    return NextResponse.json(
      { error: 'Unsupported SMS provider' },
      { status: 400 }
    );
  }

  try {
    const bodyText = await request.text();
    let payload: Record<string, unknown> = {};
    if (
      request.headers
        .get('content-type')
        ?.includes('application/x-www-form-urlencoded')
    ) {
      const params = new URLSearchParams(bodyText);
      payload = Object.fromEntries(params.entries());
    } else {
      payload = JSON.parse(bodyText || '{}');
    }

    const smsProvider =
      providerName === 'twilio'
        ? new TwilioSmsProvider()
        : new ExotelSmsProvider();
    const event = await smsProvider.normalizeWebhook(payload);
    const db = appwriteAdmin();

    const accountId =
      (payload.account_id as string) || '00000000-0000-0000-0000-000000000000';

    // Store in provider_events
    await db.from('provider_events').insert({
      account_id: accountId,
      provider: providerName,
      external_event_id: event.externalMessageId,
      event_type: 'sms_received',
      payload_hash: event.externalMessageId,
      payload,
      status: 'processed',
    });

    // Check opt-out keywords (STOP, CANCEL, UNSUBSCRIBE)
    const textContent = event.content || event.text || '';
    const phone = event.senderPhone || event.patientAddress || '';
    if (textContent.trim().toUpperCase() === 'STOP' && phone) {
      await smsProvider.processOptOut(accountId, phone);
    }

    return NextResponse.json({
      success: true,
      messageId: event.externalMessageId,
    });
  } catch (err: unknown) {
    console.error('[POST /api/webhooks/sms] Error:', err);
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}
