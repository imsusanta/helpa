import crypto from 'crypto';
import { SmsProvider } from './sms-provider.interface';
import { MessageEvent } from '../../types';

function safeStringEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, 'utf-8');
  const rightBuffer = Buffer.from(right, 'utf-8');
  return (
    leftBuffer.length === rightBuffer.length &&
    crypto.timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function formParameters(bodyText: string): Record<string, string | string[]> {
  const values = new Map<string, string[]>();
  new URLSearchParams(bodyText).forEach((value, key) => {
    values.set(key, [...(values.get(key) || []), value]);
  });

  return Object.fromEntries(
    [...values.entries()].map(([key, entries]) => [
      key,
      entries.length === 1 ? entries[0] : [...new Set(entries)].sort(),
    ])
  );
}

function signatureData(
  url: string,
  parameters: Record<string, string | string[]>
): string {
  return Object.keys(parameters)
    .sort()
    .reduce((data, key) => {
      const rawValues = parameters[key];
      const values = Array.isArray(rawValues)
        ? [...new Set(rawValues)].sort()
        : [rawValues];
      return values.reduce((result, value) => result + key + value, data);
    }, url);
}

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
    const contentType =
      request.headers.get('content-type')?.toLowerCase() || '';
    const bodyHash = new URL(url).searchParams.get('bodySHA256');
    const isJson =
      contentType.includes('application/json') || Boolean(bodyHash);

    if (isJson) {
      if (!bodyHash) return false;
      const expectedBodyHash = crypto
        .createHash('sha256')
        .update(Buffer.from(bodyText, 'utf-8'))
        .digest('hex');
      if (!safeStringEqual(bodyHash, expectedBodyHash)) return false;
    }

    const expectedData = signatureData(
      url,
      isJson ? {} : formParameters(bodyText)
    );

    const hmac = crypto
      .createHmac('sha1', authToken)
      .update(Buffer.from(expectedData, 'utf-8'))
      .digest('base64');

    return safeStringEqual(twilioSignature.trim(), hmac);
  }

  async normalizeWebhook(
    payload: Record<string, unknown>
  ): Promise<MessageEvent> {
    const get = (name: string, alternate?: string): string => {
      const value =
        payload[name] ?? (alternate ? payload[alternate] : undefined);
      return typeof value === 'string'
        ? value
        : value == null
          ? ''
          : String(value);
    };
    const msgId = get('MessageSid', 'message_sid') || get('SmsSid', 'sms_sid');
    if (!msgId) {
      throw new Error('Twilio webhook is missing MessageSid');
    }
    const body = get('Body', 'body');
    const from = get('From', 'from');
    const to = get('To', 'to');
    const timestampValue =
      get('DateSent', 'date_sent') ||
      get('Timestamp', 'timestamp') ||
      new Date().toISOString();
    const parsedTimestamp = new Date(timestampValue);
    const occurredAt = Number.isNaN(parsedTimestamp.getTime())
      ? new Date().toISOString()
      : parsedTimestamp.toISOString();

    const mediaCount = Number(get('NumMedia', 'num_media') || 0);
    const mediaUrl = mediaCount > 0 ? get('MediaUrl0', 'media_url_0') : '';
    const mediaContentType = get('MediaContentType0', 'media_content_type_0');
    const mediaType = mediaContentType.startsWith('image/')
      ? 'image'
      : mediaContentType.startsWith('audio/')
        ? 'audio'
        : mediaContentType.startsWith('video/')
          ? 'video'
          : mediaContentType.startsWith('application/')
            ? 'document'
            : undefined;

    return {
      eventId: msgId,
      messageId: msgId,
      // The route resolves the tenant from the configured receiving number.
      // Never attribute a Twilio event from a client-supplied account_id.
      clinicId: '',
      channel: 'sms',
      provider: 'twilio',
      externalMessageId: msgId,
      patientAddress: from,
      senderPhone: from,
      recipientPhone: to,
      content: body,
      text: body,
      contentType: mediaType || 'text',
      mediaUrl: mediaUrl || undefined,
      direction: 'inbound',
      status: 'delivered',
      occurredAt,
      timestamp: occurredAt,
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
