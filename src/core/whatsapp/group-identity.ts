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

export function isWhatsAppGroupJid(jid: string | null | undefined): boolean {
  const raw = String(jid || '')
    .trim()
    .toLowerCase();
  return raw.endsWith('@g.us');
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
  if (isWhatsAppGroupJid(raw)) return true;
  const digits = raw.replace(/\D/g, '');
  if (digits.length <= 15) return false;
  return digits === raw.replace(/[\s\-+()]/g, '');
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
  if (
    isWhatsAppGroupAddress(trimmedName) ||
    isWhatsAppGroupAddress(trimmedPhone)
  ) {
    return WHATSAPP_GROUP_FALLBACK_NAME;
  }
  return trimmedName || trimmedPhone || fallback;
}

export function resolvedWhatsAppContactName(
  candidateName: string | null | undefined,
  address: string,
  senderPushName?: string | null
): string {
  const addressKey = String(address || '').trim();
  const isGroup =
    isWhatsAppGroupJid(addressKey) || isWhatsAppGroupAddress(addressKey);
  const candidate = String(candidateName || '').trim();
  if (candidate && !isPlaceholderContactName(candidate, addressKey)) {
    return candidate;
  }
  if (isGroup) return WHATSAPP_GROUP_FALLBACK_NAME;
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
  const candidates = [
    nameFromUnknown(data.Name),
    nameFromUnknown(data.name),
    nameFromUnknown(data.GroupName),
    nameFromUnknown(data.groupName),
    nameFromUnknown(info.Name),
    nameFromUnknown(info.name),
    nameFromUnknown(chat.Name),
    nameFromUnknown(chat.name),
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
    isWhatsAppGroupJid(jid) ||
    isWhatsAppGroupAddress(address) ||
    isWhatsAppGroupAddress(jid);
  const subject = extractWhatsAppGroupSubject(data);
  const pushName = extractWhatsAppPushName(data);
  if (isGroup) {
    return resolvedWhatsAppContactName(subject, address || jid);
  }
  return resolvedWhatsAppContactName(subject, address || jid, pushName);
}
