import { Job } from 'bullmq';
import { WahaWhatsAppProvider } from '@/core/providers/whatsapp/waha-provider';
import { TwilioSmsProvider } from '@/core/providers/sms/twilio-provider';
import { ExotelSmsProvider } from '@/core/providers/sms/exotel-provider';

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
  const { accountId, recipientPhone, provider, messageText } = job.data;
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

  if (provider !== 'elevenlabs') throw new Error('VOICE_OPERATION_UNSUPPORTED');
  throw new Error(
    `Outbound voice jobs must use the authenticated voice command path for account ${accountId}; recipient ${recipientPhone} was not dispatched`
  );
}

export async function processProviderEventsJob(_job: Job) {
  console.log('[Worker: provider-events] Processing provider events job');
}
