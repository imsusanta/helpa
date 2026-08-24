import crypto from 'crypto';
import { WhatsAppProvider } from './whatsapp-provider.interface';
import { MessageEvent } from '../../types';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function safeStringEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, 'utf-8');
  const rightBuffer = Buffer.from(right, 'utf-8');
  return (
    leftBuffer.length === rightBuffer.length &&
    crypto.timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function mediaContentType(mimeType: string): MessageEvent['contentType'] {
  const normalized = mimeType.toLowerCase();
  if (normalized.startsWith('image/')) return 'image';
  if (normalized.startsWith('audio/')) return 'audio';
  if (normalized.startsWith('video/')) return 'video';
  if (normalized) return 'document';
  return undefined;
}

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
    const secret =
      process.env.WAHA_WEBHOOK_SECRET ||
      process.env.WAHA_WEBHOOK_HMAC_KEY ||
      process.env.WAHA_API_KEY;
    if (!secret) return false;

    // WAHA's native HMAC contract uses SHA-512 and these two headers.
    // Keep the older app-specific SHA-256 header as a compatibility path for
    // installations that already configured a custom WAHA webhook header.
    const nativeSignature = request.headers.get('x-webhook-hmac');
    if (nativeSignature) {
      const algorithm = request.headers
        .get('x-webhook-hmac-algorithm')
        ?.trim()
        .toLowerCase();
      if (algorithm !== 'sha512') return false;

      const expectedSignature = crypto
        .createHmac('sha512', secret)
        .update(bodyText)
        .digest('hex');
      return safeStringEqual(nativeSignature.trim(), expectedSignature);
    }

    const legacySignature = request.headers.get('x-waha-signature');
    if (!legacySignature) return false;

    const expectedLegacySignature = crypto
      .createHmac('sha256', secret)
      .update(bodyText)
      .digest('hex');
    return safeStringEqual(legacySignature.trim(), expectedLegacySignature);
  }

  async normalizeWebhook(
    payload: Record<string, unknown>
  ): Promise<MessageEvent[]> {
    const event = String(payload.event || '')
      .trim()
      .toLowerCase();
    const payloadData = (payload.payload as Record<string, unknown>) || payload;
    const accountId = extractValidAccountId(payload);

    // Only message/message.any represent newly-created inbox messages.
    // Reactions, acknowledgements, edits, revocations, and waiting events
    // have different payload contracts and must not create blank duplicates.
    if (event !== 'message' && event !== 'message.any') return [];

    // The route may inject a server-verified account_id before calling this
    // normalizer. Keep the provider boundary fail-closed for direct callers.
    if (!accountId) return [];

    const rawId = payloadData.id;
    const idObject =
      rawId && typeof rawId === 'object'
        ? (rawId as Record<string, unknown>)
        : null;
    const msgId = String(
      (typeof rawId === 'string' ? rawId : '') ||
        idObject?._serialized ||
        idObject?.id ||
        payloadData.messageId ||
        ''
    ).trim();
    // Provider retries are safe only when the provider supplies a stable ID.
    if (!msgId) return [];

    const from = String(payloadData.from || '');
    const to = String(payloadData.to || '');
    const body = String(
      payloadData.body ||
        payloadData.caption ||
        (payloadData.hasMedia ? '[Media]' : '')
    );
    const rawTimestamp = Number(payloadData.timestamp);
    const timestampMs =
      Number.isFinite(rawTimestamp) && rawTimestamp > 0
        ? rawTimestamp > 10_000_000_000
          ? rawTimestamp
          : rawTimestamp * 1000
        : Date.now();
    const timestampDate = new Date(timestampMs);
    const occurredAt = Number.isFinite(timestampDate.getTime())
      ? timestampDate.toISOString()
      : new Date().toISOString();
    const media =
      payloadData.media &&
      typeof payloadData.media === 'object' &&
      !Array.isArray(payloadData.media)
        ? (payloadData.media as Record<string, unknown>)
        : {};
    const mediaUrl = String(payloadData.mediaUrl || media.url || '').trim();
    const mediaMimeType = String(
      payloadData.mimetype || media.mimetype || media.mimeType || ''
    ).trim();
    const mediaType = String(payloadData.type || '').toLowerCase();
    const contentType =
      (['image', 'document', 'audio', 'video', 'location'].includes(mediaType)
        ? (mediaType as MessageEvent['contentType'])
        : mediaContentType(mediaMimeType)) ||
      (payloadData.hasMedia === true || payloadData.hasMedia === 'true'
        ? 'document'
        : 'text');

    return [
      {
        eventId: msgId,
        messageId: msgId,
        // Tenant attribution is performed by the route from server-side
        // configuration. This value is informational and never trusted.
        clinicId: accountId || '',
        channel: 'whatsapp',
        provider: 'waha',
        externalMessageId: msgId,
        patientAddress: from.replace('@c.us', ''),
        senderPhone: from.replace('@c.us', ''),
        recipientPhone: to.replace('@c.us', ''),
        content: body,
        text: body,
        contentType,
        mediaUrl: mediaUrl || undefined,
        direction:
          payloadData.fromMe === true || payloadData.fromMe === 'true'
            ? 'outbound'
            : 'inbound',
        status: 'delivered',
        occurredAt,
        timestamp: occurredAt,
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
