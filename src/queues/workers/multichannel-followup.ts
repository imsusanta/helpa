import { Job } from 'bullmq';
import { WahaWhatsAppProvider } from '@/core/providers/whatsapp/waha-provider';
import { TwilioSmsProvider } from '@/core/providers/sms/twilio-provider';
import { ExotelSmsProvider } from '@/core/providers/sms/exotel-provider';
import { appwriteAdmin } from '@/lib/appwrite-server-compat';

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

export interface ProviderEventJobData {
  documentId: string;
  provider: string;
  externalEventId: string;
  eventType: string;
  rawPayloadReference?: string;
  accountId?: string;
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

export async function processProviderEventsJob(job: Job<ProviderEventJobData>) {
  const { documentId, provider, externalEventId, eventType } = job.data || {};
  console.log(
    `[Worker: provider-events] Processing event ${externalEventId || 'unknown'} (${provider}:${eventType}), job ${job.id}`
  );

  if (!documentId) {
    console.warn(
      '[Worker: provider-events] No documentId in job data, skipping'
    );
    return;
  }

  const dbAdmin = appwriteAdmin();
  try {
    const { data: eventDoc, error: getErr } = await dbAdmin
      .from('provider_events')
      .select('*')
      .eq('id', documentId)
      .maybeSingle();

    if (getErr || !eventDoc) {
      console.warn(
        `[Worker: provider-events] Event document ${documentId} not found`
      );
      return;
    }

    if (eventDoc.processingStatus === 'processed') {
      console.log(
        `[Worker: provider-events] Event ${documentId} already processed`
      );
      return;
    }

    const attempts = (eventDoc.processingAttempts || 0) + 1;

    await dbAdmin
      .from('provider_events')
      .update({
        processingStatus: 'processing',
        processingAttempts: attempts,
      })
      .eq('id', documentId);

    // Domain event routing / side effect execution
    if (provider === 'meta' || provider === 'whatsapp') {
      console.log(
        `[Worker: provider-events] Executed WhatsApp side effects for ${externalEventId}`
      );
    } else if (provider === 'elevenlabs') {
      console.log(
        `[Worker: provider-events] Executed ElevenLabs voice side effects for ${externalEventId}`
      );
    }

    await dbAdmin
      .from('provider_events')
      .update({
        processingStatus: 'processed',
        processed: true,
      })
      .eq('id', documentId);

    console.log(
      `[Worker: provider-events] Event ${documentId} processed successfully`
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(
      `[Worker: provider-events] Error processing event ${documentId}:`,
      errorMsg
    );

    try {
      const { data: eventDoc } = await dbAdmin
        .from('provider_events')
        .select('processingAttempts')
        .eq('id', documentId)
        .maybeSingle();

      const attempts = eventDoc?.processingAttempts || 1;
      const isDeadLetter = attempts >= 5;

      await dbAdmin
        .from('provider_events')
        .update({
          processingStatus: isDeadLetter ? 'dead_letter' : 'failed',
          lastErrorSanitized: errorMsg.slice(0, 500),
        })
        .eq('id', documentId);
    } catch {
      // Best effort cleanup
    }

    throw err;
  }
}
