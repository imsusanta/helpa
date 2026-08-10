import { Job } from 'bullmq';
import { supabaseAdmin } from '@/lib/automations/admin-client';
import { WahaWhatsAppProvider } from '@/core/providers/whatsapp/waha-provider';
import { sendInteractiveButtons } from '@/lib/whatsapp/meta-api';
import { decrypt } from '@/lib/whatsapp/encryption';
import { TwilioSmsProvider } from '@/core/providers/sms/twilio-provider';
import { ExotelSmsProvider } from '@/core/providers/sms/exotel-provider';
import { getVoiceProvider } from '@/core/providers/voice/provider-factory';

export interface OutboundMessageJobData {
  accountId: string;
  contactId: string;
  recipientPhone: string;
  channel: 'whatsapp' | 'sms' | 'voice';
  provider: string;
  messageText?: string;
  templateName?: string;
  jobId?: string;
}

export async function processOutboundWhatsAppJob(
  job: Job<OutboundMessageJobData>
) {
  const {
    accountId,
    recipientPhone,
    provider,
    messageText,
    templateName: _templateName,
  } = job.data;
  console.log(
    `[Worker: outbound-whatsapp] Processing job ${job.id} for ${recipientPhone}`
  );

  if (provider === 'waha') {
    const waha = new WahaWhatsAppProvider();
    await waha.sendText(
      accountId,
      recipientPhone,
      messageText || 'Hello from clinic!'
    );
  } else {
    // Meta WhatsApp default fallback
    const db = supabaseAdmin();
    const { data: config } = await db
      .from('whatsapp_configs')
      .select('*')
      .eq('account_id', accountId)
      .eq('is_active', true)
      .single();

    if (config) {
      const accessToken = decrypt(config.access_token);
      await sendInteractiveButtons({
        phoneNumberId: config.phone_number_id,
        accessToken,
        to: recipientPhone,
        bodyText: messageText || 'Hospital Appointment Notification',
        buttons: [
          { id: 'confirm', title: 'Confirm' },
          { id: 'reschedule', title: 'Reschedule' },
        ],
      });
    }
  }
}

export async function processOutboundSmsJob(job: Job<OutboundMessageJobData>) {
  const { accountId, recipientPhone, provider, messageText } = job.data;
  console.log(
    `[Worker: outbound-sms] Processing job ${job.id} for ${recipientPhone}`
  );

  const smsProvider =
    provider === 'exotel' ? new ExotelSmsProvider() : new TwilioSmsProvider();
  await smsProvider.sendText(
    accountId,
    recipientPhone,
    messageText || 'Clinic Reminder SMS'
  );
}

export async function processOutboundVoiceJob(
  job: Job<OutboundMessageJobData>
) {
  const { accountId, recipientPhone, provider } = job.data;
  console.log(
    `[Worker: outbound-voice] Processing job ${job.id} for ${recipientPhone}`
  );

  const voiceProvider = getVoiceProvider(
    (provider as 'sarvam' | 'xai' | 'elevenlabs') || 'sarvam'
  );
  await voiceProvider.startOutboundCall({
    clinicId: accountId,
    patientPhone: recipientPhone,
    greeting:
      'Namaste, this is your appointment reminder call from the clinic.',
  });
}

export async function processProviderEventsJob(_job: Job) {
  const db = supabaseAdmin();
  const { data: pendingEvents } = await db
    .from('provider_events')
    .select('id, account_id, provider, external_event_id')
    .eq('status', 'received')
    .limit(10);

  for (const evt of pendingEvents || []) {
    await db
      .from('provider_events')
      .update({ status: 'processed', processed_at: new Date().toISOString() })
      .eq('id', evt.id);
  }
}
