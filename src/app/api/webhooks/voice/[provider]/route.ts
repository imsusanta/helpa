import { NextResponse } from 'next/server';
import { getVoiceProvider } from '@/core/providers/voice/provider-factory';
import { supabaseAdmin } from '@/lib/automations/admin-client';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider: providerName } = await params;
  if (!['sarvam', 'xai', 'elevenlabs'].includes(providerName)) {
    return NextResponse.json(
      { error: 'Unsupported voice provider' },
      { status: 400 }
    );
  }

  try {
    const bodyText = await request.text();
    const payload = JSON.parse(bodyText);

    const voiceProvider = getVoiceProvider(
      providerName as 'sarvam' | 'xai' | 'elevenlabs'
    );
    const isValid = await voiceProvider.verifyWebhook(request, bodyText);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid webhook signature' },
        { status: 401 }
      );
    }

    const event = await voiceProvider.normalizeWebhook(payload);
    const db = supabaseAdmin();

    const accountId =
      (payload.account_id as string) || '00000000-0000-0000-0000-000000000000';

    // Store call event with unique constraint handling
    await db.from('call_events').upsert(
      {
        account_id: accountId,
        call_id: event.callId,
        external_event_id: `${event.externalCallId}_${Date.now()}`,
        event_type: event.status,
        payload: payload,
        occurred_at: new Date().toISOString(),
      },
      { onConflict: 'account_id,external_event_id' }
    );

    // Update main calls record
    await db.from('calls').upsert(
      {
        account_id: accountId,
        provider: providerName,
        external_call_id: event.externalCallId,
        direction: event.direction,
        status: event.status,
        patient_phone: event.patientPhone,
        duration_seconds: event.durationSeconds,
        summary: event.summary,
        transcript: event.transcript,
        human_handoff: event.humanHandoff || false,
        ended_at:
          event.endedAt ||
          (event.status === 'completed' ? new Date().toISOString() : null),
      },
      { onConflict: 'account_id,external_call_id' }
    );

    return NextResponse.json({ success: true, callId: event.externalCallId });
  } catch (err: unknown) {
    console.error('[POST /api/webhooks/voice] Error:', err);
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}
