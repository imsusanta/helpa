import crypto from 'crypto';
import { SmsProvider } from './sms-provider.interface';
import { MessageEvent } from '../../types';

export class TwilioSmsProvider implements SmsProvider {
  readonly providerName = 'twilio';

  private async getCredentials(_clinicId: string) {
    return {
      accountSid: process.env.TWILIO_ACCOUNT_SID || '',
      authToken: process.env.TWILIO_AUTH_TOKEN || '',
      fromPhone: process.env.TWILIO_FROM_PHONE || '',
    };
  }

  async verifyWebhook(request: Request, bodyText: string): Promise<boolean> {
    const twilioSignature = request.headers.get('x-twilio-signature');
    if (!twilioSignature) return false;

    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (!authToken || authToken.startsWith('mock_')) return false;

    const url = request.url;
    const params = new URLSearchParams(bodyText);
    const data: Record<string, string> = {};
    params.forEach((val, key) => {
      data[key] = val;
    });

    let expectedData = url;
    Object.keys(data)
      .sort()
      .forEach((key) => {
        expectedData += key + data[key];
      });

    const hmac = crypto
      .createHmac('sha1', authToken)
      .update(Buffer.from(expectedData, 'utf-8'))
      .digest('base64');

    return hmac === twilioSignature;
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

    if (!accountSid || accountSid.startsWith('mock_')) {
      throw new Error(
        'Twilio credentials not configured (TWILIO_ACCOUNT_SID is missing).'
      );
    }

    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    const resp = await fetch(url, {
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

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      throw new Error(
        `Twilio API Error (${resp.status}): ${resp.statusText} ${errText}`
      );
    }

    const json = await resp.json();
    return { externalMessageId: json.sid };
  }

  async getDeliveryStatus(
    _clinicId: string,
    externalMessageId: string
  ): Promise<{ status: string }> {
    const { accountSid, authToken } = await this.getCredentials(_clinicId);
    if (!accountSid || accountSid.startsWith('mock_')) {
      return { status: 'unknown' };
    }

    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages/${externalMessageId}.json`;
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    const resp = await fetch(url, {
      headers: { Authorization: `Basic ${auth}` },
    });

    if (!resp.ok) return { status: 'unknown' };
    const json = await resp.json();
    return { status: json.status || 'unknown' };
  }

  async processOptOut(
    _clinicId: string,
    _recipientPhone: string
  ): Promise<boolean> {
    return true;
  }
}
