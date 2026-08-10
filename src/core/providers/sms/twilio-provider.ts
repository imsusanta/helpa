import { SmsProvider } from './sms-provider.interface';
import { MessageEvent } from '../../types';
import { supabaseAdmin } from '@/lib/automations/admin-client';
import { decrypt } from '@/lib/whatsapp/encryption';

export class TwilioSmsProvider implements SmsProvider {
  readonly providerName = 'twilio';

  private async getCredentials(clinicId: string) {
    const db = supabaseAdmin();
    const { data: integ } = await db
      .from('clinic_integrations')
      .select('encrypted_credentials')
      .eq('account_id', clinicId)
      .eq('provider', 'twilio')
      .single();

    if (integ?.encrypted_credentials) {
      try {
        const parsed = JSON.parse(decrypt(integ.encrypted_credentials));
        return {
          accountSid: parsed.accountSid || process.env.TWILIO_ACCOUNT_SID,
          authToken: parsed.authToken || process.env.TWILIO_AUTH_TOKEN,
          fromPhone: parsed.fromPhone || process.env.TWILIO_FROM_PHONE,
        };
      } catch {
        // fallback
      }
    }

    return {
      accountSid: process.env.TWILIO_ACCOUNT_SID || 'mock_sid',
      authToken: process.env.TWILIO_AUTH_TOKEN || 'mock_token',
      fromPhone: process.env.TWILIO_FROM_PHONE || '+18005550199',
    };
  }

  async verifyWebhook(_request: Request, _bodyText: string): Promise<boolean> {
    return true;
  }

  async normalizeWebhook(
    payload: Record<string, unknown>
  ): Promise<MessageEvent> {
    const msgId =
      (payload.MessageSid as string) ||
      (payload.SmsSid as string) ||
      `tw_${Date.now()}`;
    const body = (payload.Body as string) || '';
    const from = (payload.From as string) || '';
    const accountId =
      (payload.account_id as string) || '00000000-0000-0000-0000-000000000000';

    return {
      eventId: msgId,
      messageId: msgId,
      clinicId: accountId,
      channel: 'sms',
      provider: 'twilio',
      externalMessageId: msgId,
      patientAddress: from,
      senderPhone: from,
      recipientPhone: (payload.To as string) || '',
      content: body,
      text: body,
      direction: 'inbound',
      status: 'delivered',
      occurredAt: new Date().toISOString(),
      timestamp: new Date().toISOString(),
    };
  }

  async sendText(
    clinicId: string,
    recipientPhone: string,
    text: string
  ): Promise<{ externalMessageId: string }> {
    const { accountSid, authToken, fromPhone } =
      await this.getCredentials(clinicId);
    const externalMessageId = `SM${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 7)}`;

    if (accountSid && !accountSid.startsWith('mock_')) {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
      const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
      await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: recipientPhone,
          From: fromPhone,
          Body: text,
        }),
      });
    }

    return { externalMessageId };
  }

  async getDeliveryStatus(
    _clinicId: string,
    _externalMessageId: string
  ): Promise<{ status: string }> {
    return { status: 'delivered' };
  }

  async processOptOut(
    clinicId: string,
    recipientPhone: string
  ): Promise<boolean> {
    const db = supabaseAdmin();
    await db
      .from('contact_channels')
      .update({ consent: false })
      .eq('account_id', clinicId)
      .eq('phone', recipientPhone);
    return true;
  }
}
