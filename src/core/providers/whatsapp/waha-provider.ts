import crypto from 'crypto';
import { WhatsAppProvider } from './whatsapp-provider.interface';
import { MessageEvent } from '../../types';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * CRITICAL SECURITY INVARIANT:
 * The client-supplied `account_id` must be a structurally valid UUID.
 * A missing or malformed identifier must never be coerced into a
 * placeholder/fallback tenant. Database existence of the account is
 * verified separately by the webhook route before any persistence.
 */
export function extractValidAccountId(
  payload: Record<string, unknown>
): string | null {
  const raw = payload.account_id;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return UUID_PATTERN.test(trimmed) ? trimmed : null;
}

export class WahaWhatsAppProvider implements WhatsAppProvider {
  readonly providerName = 'waha';

  private async getWahaConfig(_clinicId: string) {
    return {
      baseUrl: process.env.WAHA_BASE_URL || 'http://localhost:3000',
      apiKey: process.env.WAHA_API_KEY || '',
      session: 'default',
    };
  }

  async verifyWebhook(request: Request, bodyText: string): Promise<boolean> {
    const signature = request.headers.get('x-waha-signature');
    const secret = process.env.WAHA_WEBHOOK_SECRET || process.env.WAHA_API_KEY;

    if (!secret) return false;
    if (!signature) return false;

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(bodyText)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature, 'utf-8'),
      Buffer.from(expectedSignature, 'utf-8')
    );
  }

  async normalizeWebhook(
    payload: Record<string, unknown>
  ): Promise<MessageEvent[]> {
    const event = (payload.event as string) || '';
    const payloadData = (payload.payload as Record<string, unknown>) || payload;
    const accountId = extractValidAccountId(payload);

    if (!event.startsWith('message')) return [];

    // Never emit events attributed to an unverified tenant
    if (!accountId) return [];

    const msgId = String(payloadData.id || `waha_${Date.now()}`);
    const from = String(payloadData.from || '');
    const to = String(payloadData.to || '');
    const body = String(
      payloadData.body || (payloadData.hasMedia ? '[Media]' : '')
    );

    return [
      {
        eventId: msgId,
        messageId: msgId,
        clinicId: accountId,
        channel: 'whatsapp',
        provider: 'waha',
        externalMessageId: msgId,
        patientAddress: from.replace('@c.us', ''),
        senderPhone: from.replace('@c.us', ''),
        recipientPhone: to.replace('@c.us', ''),
        content: body,
        text: body,
        direction: payloadData.fromMe ? 'outbound' : 'inbound',
        status: 'delivered',
        occurredAt: new Date(
          ((payloadData.timestamp as number) || Date.now() / 1000) * 1000
        ).toISOString(),
        timestamp: new Date(
          ((payloadData.timestamp as number) || Date.now() / 1000) * 1000
        ).toISOString(),
      },
    ];
  }

  async sendText(
    clinicId: string,
    recipientPhone: string,
    text: string
  ): Promise<{ externalMessageId: string }> {
    const config = await this.getWahaConfig(clinicId);
    const chatId = recipientPhone.includes('@')
      ? recipientPhone
      : `${recipientPhone.replace(/[^0-9]/g, '')}@c.us`;

    const url = `${config.baseUrl}/api/sendText`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey ? { 'X-Api-Key': config.apiKey } : {}),
      },
      body: JSON.stringify({
        session: config.session,
        chatId,
        text,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      throw new Error(
        `WAHA API Error (${resp.status}): ${resp.statusText} ${errText}`
      );
    }

    const json = await resp.json().catch(() => ({}));
    const externalMessageId =
      json.id ||
      json.key?.id ||
      `waha_msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    return { externalMessageId };
  }

  async sendTemplate(
    clinicId: string,
    recipientPhone: string,
    templateName: string,
    _language: string,
    _components?: unknown[]
  ): Promise<{ externalMessageId: string }> {
    return this.sendText(
      clinicId,
      recipientPhone,
      `[Template: ${templateName}]`
    );
  }

  async sendMedia(
    clinicId: string,
    recipientPhone: string,
    mediaUrl: string,
    _mediaType: 'image' | 'document' | 'audio' | 'video',
    caption?: string
  ): Promise<{ externalMessageId: string }> {
    const config = await this.getWahaConfig(clinicId);
    const chatId = recipientPhone.includes('@')
      ? recipientPhone
      : `${recipientPhone.replace(/[^0-9]/g, '')}@c.us`;

    const url = `${config.baseUrl}/api/sendImage`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey ? { 'X-Api-Key': config.apiKey } : {}),
      },
      body: JSON.stringify({
        session: config.session,
        chatId,
        file: { url: mediaUrl },
        caption: caption || '',
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      throw new Error(
        `WAHA Media API Error (${resp.status}): ${resp.statusText} ${errText}`
      );
    }

    const json = await resp.json().catch(() => ({}));
    return {
      externalMessageId: json.id || json.key?.id || `waha_media_${Date.now()}`,
    };
  }

  async getSessionHealth(clinicId: string): Promise<{
    status: 'active' | 'degraded' | 'disconnected';
    lastCheckAt: string;
  }> {
    const config = await this.getWahaConfig(clinicId);
    try {
      const resp = await fetch(
        `${config.baseUrl}/api/sessions/${config.session}`,
        {
          headers: config.apiKey ? { 'X-Api-Key': config.apiKey } : {},
        }
      );
      if (resp.ok) {
        return { status: 'active', lastCheckAt: new Date().toISOString() };
      }
    } catch {
      // session check failed
    }
    return { status: 'disconnected', lastCheckAt: new Date().toISOString() };
  }
}
