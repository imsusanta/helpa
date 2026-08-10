import { NextResponse } from 'next/server';
import { DefaultCalendlyProvider } from '@/core/providers/calendly/calendly-provider';
import { appwriteAdmin } from '@/lib/appwrite-server-compat';
import { TrustedActionExecutor } from '@/core/actions/action-executor';

export async function POST(request: Request) {
  try {
    const bodyText = await request.text();
    const payload = JSON.parse(bodyText);

    const provider = new DefaultCalendlyProvider();
    const isValid = await provider.verifyWebhook(request, bodyText);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid webhook signature' },
        { status: 401 }
      );
    }

    const event = await provider.normalizeWebhook(payload);
    const db = appwriteAdmin();

    // Store raw provider event
    const { data: provEvent } = await db
      .from('provider_events')
      .insert({
        account_id:
          payload.account_id || '00000000-0000-0000-0000-000000000000',
        provider: 'calendly',
        external_event_id: event.eventId,
        event_type: event.type,
        payload_hash: event.eventId,
        payload: payload,
        status: 'processed',
      })
      .select('account_id')
      .single();

    const accountId = provEvent?.account_id || payload.account_id;

    if (event.type === 'scheduled' && accountId) {
      // Find lead/contact matching patient phone or email
      const { data: contact } = await db
        .from('contacts')
        .select('id')
        .eq('account_id', accountId)
        .or(`phone.eq.${event.patientPhone},email.eq.${event.patientEmail}`)
        .maybeSingle();

      let dealId: string | null = null;
      if (contact) {
        const { data: deal } = await db
          .from('deals')
          .select('id')
          .eq('account_id', accountId)
          .eq('contact_id', contact.id)
          .maybeSingle();
        dealId = deal?.id || null;
      }

      // Create or update appointment
      const startTimeStr =
        event.startTime || event.startAt || new Date().toISOString();
      const { data: appt } = await db
        .from('appointments')
        .upsert({
          account_id: accountId,
          patient_name: event.patientName || 'Patient',
          patient_phone: event.patientPhone || '',
          appointment_date: startTimeStr.split('T')[0],
          appointment_time: startTimeStr.split('T')[1]?.slice(0, 5) || '10:00',
          status: 'Confirmed',
          calendly_event_uri: event.eventId,
          calendly_invitee_uri: event.inviteeUri,
          booking_source: 'calendly_webhook',
        })
        .select('id')
        .single();

      if (dealId && appt) {
        const executor = new TrustedActionExecutor({
          accountId,
          actorId: accountId,
          actorType: 'webhook',
        });
        await executor.transitionLead({
          leadId: dealId,
          nextStage: 'BOOKED',
          reason: 'Scheduled via Calendly webhook',
        });
      }
    } else if (event.type === 'canceled' && accountId) {
      await db
        .from('appointments')
        .update({
          status: 'Cancelled',
        })
        .eq('account_id', accountId)
        .eq('calendly_invitee_uri', event.inviteeUri);
    }

    return NextResponse.json({ success: true, event });
  } catch (err: unknown) {
    console.error('[POST /api/webhooks/calendly] Error:', err);
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}
