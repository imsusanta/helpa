/**
 * WhatsApp JID / group-title helpers.
 *
 * Group chats arrive as `120363…@g.us`. phoneFromWhatsAppJid() keeps only
 * the digits, so the inbox previously stored and displayed that raw id.
 * Sender pushName is the participant, not the group subject.
 */

export const WHATSAPP_GROUP_FALLBACK_NAME = 'WhatsApp group';

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

function nameFromUnknown(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  const record = asRecord(value);
  return firstString(record.Name, record.name, record.subject, record.Subject);
}

export type WhatsAppChatKind = 'direct' | 'group' | 'channel';

export function isWhatsAppGroupJid(jid: string | null | undefined): boolean {
  const raw = String(jid || '')
    .trim()
    .toLowerCase();
  return raw.endsWith('@g.us');
}

export function isWhatsAppChannelJid(jid: string | null | undefined): boolean {
  const raw = String(jid || '')
    .trim()
    .toLowerCase();
  if (!raw || raw === 'status@broadcast') return false;
  return raw.endsWith('@newsletter') || raw.endsWith('@broadcast');
}

/**
 * True for a group JID or a stored group key (digits longer than E.164).
 * Personal numbers are at most 15 digits; WhatsApp group ids are typically 18.
 */
export function isWhatsAppGroupAddress(
  value: string | null | undefined
): boolean {
  const raw = String(value || '').trim();
  if (!raw) return false;
  if (isWhatsAppChannelJid(raw)) return false;
  if (isWhatsAppGroupJid(raw)) return true;
  if (
    raw.toLowerCase().includes('@g.us') ||
    raw.toLowerCase().includes('@broadcast') ||
    raw.toLowerCase().includes('@newsletter')
  ) {
    return true;
  }
  const digits = raw.replace(/\D/g, '');
  if (digits.length > 15) return true;
  if (digits.startsWith('120363')) return true;
  return false;
}

/**
 * True only for valid individual human phone numbers (7 to 15 digits, E.164 standard).
 * Rejects group IDs, broadcast JIDs, channel JIDs, and corrupted numeric strings.
 */
export function isValidIndividualPhone(
  value: string | null | undefined
): boolean {
  const raw = String(value || '').trim();
  if (!raw) return false;
  if (isWhatsAppGroupAddress(raw) || isWhatsAppGroupJid(raw)) return false;
  const digits = raw.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
}

/**
 * True if a contact record represents a real individual customer/patient/lead.
 */
export function isIndividualContact(
  contact:
    | {
        phone?: string | null;
        name?: string | null;
      }
    | null
    | undefined
): boolean {
  if (!contact) return false;
  if (!isValidIndividualPhone(contact.phone)) return false;
  if (isWhatsAppGroupAddress(contact.name)) return false;
  return true;
}

export function isWhatsAppChannelAddress(
  value: string | null | undefined
): boolean {
  return isWhatsAppChannelJid(value);
}

export function isWhatsAppCollectiveAddress(
  value: string | null | undefined
): boolean {
  return isWhatsAppGroupAddress(value) || isWhatsAppChannelAddress(value);
}

export function whatsappChatKind(
  address?: string | null,
  metadata?: Record<string, unknown> | null
): WhatsAppChatKind {
  const stored = String(metadata?.whatsapp_chat_kind || '').toLowerCase();
  if (stored === 'channel' || stored === 'group' || stored === 'direct') {
    return stored;
  }
  const jid = String(metadata?.whatsapp_jid || address || '');
  if (isWhatsAppChannelJid(jid) || isWhatsAppChannelAddress(address)) {
    return 'channel';
  }
  if (isWhatsAppGroupJid(jid) || isWhatsAppGroupAddress(address)) {
    return 'group';
  }
  return 'direct';
}

export function whatsappChatKindLabel(kind: WhatsAppChatKind): string {
  if (kind === 'channel') return 'Channel';
  if (kind === 'group') return 'Group';
  return '';
}

export function isHiddenWhatsAppInboxChat(
  _address?: string | null,
  _metadata?: Record<string, unknown> | null
): boolean {
  return false;
}

export function parseWhatsAppSenderPreview(text: string | null | undefined): {
  sender: string;
  body: string;
} {
  const raw = String(text || '').trim();
  const match = raw.match(/^([^:]{1,40}):\s+([\s\S]+)$/);
  if (!match) return { sender: '', body: raw };
  const sender = match[1].trim();
  if (!sender || /https?:\/\//i.test(sender) || /^\d+$/.test(sender)) {
    return { sender: '', body: raw };
  }
  return { sender, body: match[2] };
}

export function isPlaceholderContactName(
  name: string | null | undefined,
  phone?: string | null
): boolean {
  const trimmed = String(name || '').trim();
  if (!trimmed) return true;
  if (trimmed.toLowerCase() === WHATSAPP_GROUP_FALLBACK_NAME.toLowerCase()) {
    return true;
  }
  const phoneRaw = String(phone || '').trim();
  if (phoneRaw && trimmed === phoneRaw) return true;
  const nameDigits = trimmed.replace(/[\s\-+]/g, '');
  const phoneDigits = phoneRaw.replace(/\D/g, '');
  if (phoneDigits && nameDigits === phoneDigits) return true;
  if (trimmed.startsWith('+') && /^\+?[\d\s-]+$/.test(trimmed)) return true;
  if (/^\d+$/.test(nameDigits)) return true;
  return false;
}

export function whatsappContactDisplayName(
  name?: string | null,
  phone?: string | null,
  fallback = 'Contact'
): string {
  const trimmedName = String(name || '').trim();
  const trimmedPhone = String(phone || '').trim();
  if (trimmedName && !isPlaceholderContactName(trimmedName, trimmedPhone)) {
    return trimmedName;
  }
  const alt = String(fallback || '').trim();
  if (
    isWhatsAppCollectiveAddress(trimmedName) ||
    isWhatsAppCollectiveAddress(trimmedPhone)
  ) {
    const generic = new Set([
      'contact',
      'unknown contact',
      'chat',
      WHATSAPP_GROUP_FALLBACK_NAME.toLowerCase(),
    ]);
    if (
      alt &&
      !generic.has(alt.toLowerCase()) &&
      !isPlaceholderContactName(alt, trimmedPhone) &&
      !isWhatsAppGroupAddress(alt)
    ) {
      return alt;
    }
    return '';
  }
  return trimmedName || trimmedPhone || fallback;
}

export function resolvedWhatsAppContactName(
  candidateName: string | null | undefined,
  address: string,
  senderPushName?: string | null
): string {
  const addressKey = String(address || '').trim();
  const isGroup = isWhatsAppCollectiveAddress(addressKey);
  const candidate = String(candidateName || '').trim();
  if (candidate && !isPlaceholderContactName(candidate, addressKey)) {
    return candidate;
  }
  if (isGroup) return '';
  const pushName = String(senderPushName || '').trim();
  if (pushName && !isPlaceholderContactName(pushName, addressKey)) {
    return pushName;
  }
  return candidate || addressKey;
}

export function extractWhatsAppGroupSubject(
  data: Record<string, unknown>
): string {
  const info = asRecord(data.Info || data.info);
  const chat = asRecord(data.chat || data.Chat);
  const thread = asRecord(
    data.thread_metadata || data.ThreadMetadata || data.threadMetadata
  );
  const threadName = asRecord(thread.name || thread.Name);
  const candidates = [
    nameFromUnknown(data.Name),
    nameFromUnknown(data.name),
    nameFromUnknown(data.GroupName),
    nameFromUnknown(data.groupName),
    nameFromUnknown(info.Name),
    nameFromUnknown(info.name),
    nameFromUnknown(chat.Name),
    nameFromUnknown(chat.name),
    asString(threadName.text),
    nameFromUnknown(thread.name),
    asString(data.subject),
    asString(data.Subject),
    asString(chat.subject),
  ];
  for (const candidate of candidates) {
    if (candidate && !isPlaceholderContactName(candidate)) {
      return candidate;
    }
  }
  return '';
}

export function extractWhatsAppGroupJid(data: Record<string, unknown>): string {
  const info = asRecord(data.Info || data.info);
  const key = asRecord(data.key || data.Key);
  const chat = data.chat || data.Chat;
  const chatJid =
    typeof chat === 'string'
      ? chat.trim()
      : firstString(asRecord(chat).id, asRecord(chat).jid, asRecord(chat).JID);
  return firstString(
    data.JID,
    data.jid,
    data.groupJid,
    data.group_jid,
    key.remoteJid,
    key.RemoteJid,
    info.Chat,
    info.chat,
    chatJid
  );
}

export function formatGroupInboundText(
  senderName: string | null | undefined,
  text: string | null | undefined,
  contentType?: string | null
): string {
  const body =
    String(text || '').trim() ||
    (contentType && contentType !== 'text' ? `[${contentType}]` : '');
  const sender = String(senderName || '').trim();
  if (!body) return sender;
  if (!sender) return body;
  if (body.toLowerCase().startsWith(`${sender.toLowerCase()}:`)) return body;
  return `${sender}: ${body}`;
}

export function extractWhatsAppPushName(data: Record<string, unknown>): string {
  const info = asRecord(data.Info || data.info);
  return firstString(
    data.pushName,
    data.PushName,
    info.PushName,
    info.pushName
  );
}

export function isEvolutionGroupEvent(
  payload: Record<string, unknown>
): boolean {
  const name = firstString(
    payload.event,
    payload.type,
    payload.Event
  ).toLowerCase();
  return (
    name === 'groupinfo' ||
    name === 'joinedgroup' ||
    name === 'group_update' ||
    name === 'group-update' ||
    name === 'group'
  );
}

export function inboundWhatsAppContactName(
  payload: Record<string, unknown>,
  address: string
): string {
  const data = asRecord(payload.data ?? payload.Data ?? payload.payload);
  const jid = extractWhatsAppGroupJid(data);
  const isGroup =
    isWhatsAppCollectiveAddress(jid) || isWhatsAppCollectiveAddress(address);
  const subject = extractWhatsAppGroupSubject(data);
  const pushName = extractWhatsAppPushName(data);
  if (isGroup) {
    return resolvedWhatsAppContactName(subject, address || jid);
  }
  return resolvedWhatsAppContactName(subject, address || jid, pushName);
}
