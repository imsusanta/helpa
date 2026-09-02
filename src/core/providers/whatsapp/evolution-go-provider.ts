/**
 * Evolution Go v0.7.2 WhatsAppProvider.
 *
 * Verified contracts:
 *   POST /send/text, POST /send/media, POST /send/button (pkg/routes/routes.go)
 *   Webhook events: Message, Receipt, Connected, Disconnected, LoggedOut
 *   (docs/wiki/recursos-avancados/events-system.md @ 0.7.2)
 *
 * Evolution Go does not implement Meta-approved message templates.
 */

import crypto from 'node:crypto';
import type { MessageEvent } from '@/core/types';
import {
  UnsupportedWhatsAppOperationError,
  type WhatsAppProvider,
} from '@/core/providers/whatsapp/whatsapp-provider.interface';
import {
  getEvolutionGoStatus,
  sendEvolutionGoButtons,
  sendEvolutionGoMedia,
  sendEvolutionGoText,
} from '@/core/providers/whatsapp/evolution-go-client';
import { phoneFromWhatsAppJid } from '@/core/whatsapp/canonical-config';
import { sanitizePhoneForMeta } from '@/lib/whatsapp/phone-utils';

export interface EvolutionGoProviderOptions {
  accountId: string;
  instanceToken: string;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    const text = asString(value);
    if (text) return text;
  }
  return '';
}

function eventName(payload: Record<string, unknown>): string {
  return firstString(payload.event, payload.type, payload.Event).toLowerCase();
}

function payloadData(
  payload: Record<string, unknown>
): Record<string, unknown> {
  const data = payload.data ?? payload.Data ?? payload.payload;
  return asRecord(data);
}

function isLidJid(jid: string): boolean {
  return String(jid || '')
    .toLowerCase()
    .includes('@lid');
}

function isCollectiveJid(jid: string): boolean {
  const lower = String(jid || '').toLowerCase();
  return (
    lower.includes('@g.us') ||
    lower.includes('@newsletter') ||
    lower.includes('@broadcast')
  );
}

function extractMessageKey(data: Record<string, unknown>): {
  id: string;
  fromMe: boolean;
  remoteJid: string;
} {
  const key = asRecord(data.key || data.Key);
  const info = asRecord(data.Info || data.info);
  const id = firstString(key.id, key.ID, info.ID, info.id, data.id, data.ID);
  const fromMe = Boolean(
    key.fromMe ??
    key.FromMe ??
    info.IsFromMe ??
    info.isFromMe ??
    data.fromMe ??
    data.IsFromMe
  );

  const rawJid = firstString(
    key.remoteJid,
    key.RemoteJid,
    info.Chat,
    info.chat,
    data.remoteJid,
    data.chat
  );

  // If the chat is a group or channel, the collective JID is the correct remoteJid
  if (isCollectiveJid(rawJid)) {
    return { id, fromMe, remoteJid: rawJid };
  }

  // Check all available candidate JIDs
  const candidateJids = [
    firstString(key.remoteJidAlt, key.RemoteJidAlt, key.remoteJidPn),
    firstString(key.participantAlt, key.ParticipantAlt, key.participantPn),
    firstString(info.SenderAlt, info.senderAlt, info.SenderPn),
    firstString(data.senderPn, data.senderPhone, data.sender),
    rawJid,
    firstString(key.participant, key.Participant, info.Sender, info.sender),
  ].filter(Boolean);

  // Prioritize standard phone JID (@s.whatsapp.net / @c.us) over @lid
  let remoteJid = candidateJids.find(
    (j) =>
      !isLidJid(j) && (j.includes('@s.whatsapp.net') || j.includes('@c.us'))
  );
  if (!remoteJid) {
    remoteJid = candidateJids.find((j) => !isLidJid(j));
  }
  if (!remoteJid) {
    remoteJid = candidateJids[0] || '';
  }

  return { id, fromMe, remoteJid };
}

function unwrapMessage(
  message: Record<string, unknown>
): Record<string, unknown> {
  const nested = firstRecord(
    asRecord(message.ephemeralMessage || message.EphemeralMessage).message,
    asRecord(message.viewOnceMessage || message.ViewOnceMessage).message,
    asRecord(message.viewOnceMessageV2 || message.ViewOnceMessageV2).message,
    asRecord(message.documentWithCaptionMessage).message
  );
  return nested || message;
}

function firstRecord(...values: unknown[]): Record<string, unknown> | null {
  for (const value of values) {
    const record = asRecord(value);
    if (Object.keys(record).length > 0) return record;
  }
  return null;
}

function extractText(data: Record<string, unknown>): string {
  const message = unwrapMessage(asRecord(data.message || data.Message));
  const conversation = firstString(
    message.conversation,
    message.Conversation,
    asRecord(message.extendedTextMessage).text,
    asRecord(message.ExtendedTextMessage).text,
    asRecord(message.imageMessage).caption,
    asRecord(message.ImageMessage).caption,
    asRecord(message.videoMessage).caption,
    asRecord(message.documentMessage).caption,
    asRecord(message.buttonsResponseMessage).selectedDisplayText,
    asRecord(message.ButtonsResponseMessage).selectedDisplayText,
    asRecord(message.listResponseMessage).title,
    asRecord(message.listResponseMessage).description,
    asRecord(message.templateButtonReplyMessage).selectedDisplayText,
    asRecord(message.reactionMessage).text,
    data.conversation,
    data.text,
    data.body
  );
  return conversation;
}

export function extractEvolutionButtonReplyId(
  data: Record<string, unknown>
): string {
  const message = unwrapMessage(asRecord(data.message || data.Message));
  return firstString(
    asRecord(message.buttonsResponseMessage).selectedButtonId,
    asRecord(message.buttonsResponseMessage).selectedButtonID,
    asRecord(message.ButtonsResponseMessage).selectedButtonId,
    asRecord(message.ButtonsResponseMessage).SelectedButtonID,
    asRecord(message.templateButtonReplyMessage).selectedId,
    asRecord(message.templateButtonReplyMessage).selectedID,
    asRecord(message.TemplateButtonReplyMessage).selectedId
  );
}

function extractMedia(data: Record<string, unknown>): {
  contentType: MessageEvent['contentType'];
  mediaUrl?: string;
} {
  const message = asRecord(data.message || data.Message);
  if (message.imageMessage || message.ImageMessage) {
    return {
      contentType: 'image',
      mediaUrl:
        firstString(
          asRecord(message.imageMessage).url,
          asRecord(message.ImageMessage).URL
        ) || undefined,
    };
  }
  if (message.videoMessage || message.VideoMessage) {
    return {
      contentType: 'video',
      mediaUrl:
        firstString(
          asRecord(message.videoMessage).url,
          asRecord(message.VideoMessage).URL
        ) || undefined,
    };
  }
  if (
    message.audioMessage ||
    message.AudioMessage ||
    message.pttMessage ||
    message.PTTMessage
  ) {
    return {
      contentType: 'audio',
      mediaUrl:
        firstString(
          asRecord(message.audioMessage).url,
          asRecord(message.AudioMessage).URL
        ) || undefined,
    };
  }
  if (message.documentMessage || message.DocumentMessage) {
    return {
      contentType: 'document',
      mediaUrl:
        firstString(
          asRecord(message.documentMessage).url,
          asRecord(message.DocumentMessage).URL
        ) || undefined,
    };
  }
  return { contentType: 'text' };
}

function extractTimestamp(data: Record<string, unknown>): string {
  const info = asRecord(data.Info || data.info);
  const raw =
    data.messageTimestamp ||
    data.timestamp ||
    info.Timestamp ||
    info.timestamp ||
    Date.now() / 1000;
  const numeric = Number(raw);
  const ms =
    Number.isFinite(numeric) && numeric > 0
      ? numeric > 10_000_000_000
        ? numeric
        : numeric * 1000
      : Date.now();
  const date = new Date(ms);
  return Number.isFinite(date.getTime())
    ? date.toISOString()
    : new Date().toISOString();
}

function recipientNumber(phone: string): string {
  return sanitizePhoneForMeta(phone) || phone.replace(/\D/g, '');
}

export function evolutionWebhookEventType(
  payload: Record<string, unknown>
): string {
  return firstString(payload.event, payload.type) || 'evolution_event';
}

export function isEvolutionReceiptEvent(
  payload: Record<string, unknown>
): boolean {
  const name = eventName(payload);
  return name === 'receipt' || name === 'read_receipt' || name === 'messageack';
}

export function isEvolutionConnectionEvent(
  payload: Record<string, unknown>
): boolean {
  const name = eventName(payload);
  return (
    name === 'connected' ||
    name === 'disconnected' ||
    name === 'loggedout' ||
    name === 'logged_out' ||
    name === 'pairsuccess' ||
    name === 'pair_success' ||
    name === 'connection' ||
    name === 'qrcode'
  );
}

const WEBHOOK_SECRET_KEYS = new Set([
  'instancetoken',
  'token',
  'apikey',
  'access_token',
  'accesstoken',
  'webhook_secret',
  'webhooksecret',
  'globalapikey',
  'global_api_key',
]);

export function redactEvolutionWebhookPayload(
  payload: Record<string, unknown>
): Record<string, unknown> {
  // JSON.stringify's replacer drops secret keys without assigning
  // attacker-controlled property names onto a new object (CodeQL
  // js/remote-property-injection). Parsed webhook JSON is acyclic.
  return JSON.parse(
    JSON.stringify(payload, (key, value) =>
      WEBHOOK_SECRET_KEYS.has(String(key).toLowerCase()) ? undefined : value
    )
  ) as Record<string, unknown>;
}

export class EvolutionGoProvider implements WhatsAppProvider {
  readonly providerName = 'evolution' as const;
  private readonly accountId: string;
  private readonly instanceToken: string;

  constructor(options: EvolutionGoProviderOptions) {
    this.accountId = options.accountId;
    this.instanceToken = options.instanceToken;
  }

  async verifyWebhook(_request: Request, _bodyText: string): Promise<boolean> {
    // Evolution Go v0.7.2 webhook_producer.go POSTs JSON with no HMAC.
    // Tenant auth is the high-entropy secret in the webhook URL.
    return true;
  }

  async normalizeWebhook(
    payload: Record<string, unknown>
  ): Promise<MessageEvent[]> {
    const name = eventName(payload);
    if (
      name &&
      name !== 'message' &&
      name !== 'messages' &&
      name !== 'messages.upsert'
    ) {
      return [];
    }
    const data = payloadData(payload);
    const key = extractMessageKey(data);
    if (!key.id) return [];

    const media = extractMedia(data);
    const text = extractText(data);
    const interactiveReplyId = extractEvolutionButtonReplyId(data);
    const occurredAt = extractTimestamp(data);
    const remotePhone = phoneFromWhatsAppJid(key.remoteJid);
    const senderPhone = key.fromMe
      ? phoneFromWhatsAppJid(
          firstString(
            asRecord(data.Info).Sender,
            asRecord(data.info).sender,
            key.remoteJid
          )
        )
      : remotePhone;

    return [
      {
        eventId: key.id,
        messageId: key.id,
        clinicId: this.accountId,
        provider: 'evolution',
        channel: 'whatsapp',
        externalMessageId: key.id,
        direction: key.fromMe ? 'outbound' : 'inbound',
        patientAddress: remotePhone,
        senderPhone,
        recipientPhone: key.fromMe ? remotePhone : '',
        content: text,
        text,
        interactiveReplyId: interactiveReplyId || undefined,
        contentType: media.contentType,
        mediaUrl: media.mediaUrl,
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
    if (clinicId && clinicId !== this.accountId) {
      throw new Error('Evolution Go send is scoped to the resolved tenant.');
    }
    return sendEvolutionGoText(this.instanceToken, {
      number: recipientNumber(recipientPhone),
      text,
    });
  }

  async sendButtons(
    clinicId: string,
    recipientPhone: string,
    bodyText: string,
    buttons: Array<{ id: string; title: string }>,
    headerText?: string,
    footerText?: string
  ): Promise<{ externalMessageId: string }> {
    if (clinicId && clinicId !== this.accountId) {
      throw new Error('Evolution Go send is scoped to the resolved tenant.');
    }
    return sendEvolutionGoButtons(this.instanceToken, {
      number: recipientNumber(recipientPhone),
      title: headerText || 'Booking Confirm',
      description: bodyText,
      footer: footerText || 'Helpa',
      buttons,
    });
  }

  async sendTemplate(
    _clinicId: string,
    _recipientPhone: string,
    templateName: string,
    _language?: string,
    _components?: unknown[]
  ): Promise<{ externalMessageId: string }> {
    throw new UnsupportedWhatsAppOperationError(
      'evolution',
      'sendTemplate',
      `Meta-approved WhatsApp templates are not available on a QR linked-device connection. Template "${templateName}" was not sent.`
    );
  }

  async sendMedia(
    clinicId: string,
    recipientPhone: string,
    mediaUrl: string,
    mediaType: 'image' | 'document' | 'audio' | 'video',
    caption?: string
  ): Promise<{ externalMessageId: string }> {
    if (clinicId && clinicId !== this.accountId) {
      throw new Error('Evolution Go send is scoped to the resolved tenant.');
    }
    return sendEvolutionGoMedia(this.instanceToken, {
      number: recipientNumber(recipientPhone),
      url: mediaUrl,
      type: mediaType,
      caption,
    });
  }

  async getSessionHealth(_clinicId: string): Promise<{
    status: 'active' | 'degraded' | 'disconnected';
    lastCheckAt: string;
  }> {
    const lastCheckAt = new Date().toISOString();
    try {
      const status = await getEvolutionGoStatus(this.instanceToken);
      if (status.connected && status.loggedIn) {
        return { status: 'active', lastCheckAt };
      }
      if (status.connected || status.loggedIn) {
        return { status: 'degraded', lastCheckAt };
      }
      return { status: 'disconnected', lastCheckAt };
    } catch {
      return { status: 'disconnected', lastCheckAt };
    }
  }
}

export function hashWebhookSecret(secret: string): string {
  return crypto.createHash('sha256').update(secret, 'utf8').digest('hex');
}

export function webhookSecretMatches(
  secret: string,
  storedHash: string
): boolean {
  if (!secret || !storedHash) return false;
  const actual = Buffer.from(hashWebhookSecret(secret), 'hex');
  const expected = Buffer.from(storedHash, 'hex');
  return (
    actual.length === expected.length &&
    crypto.timingSafeEqual(actual, expected)
  );
}
