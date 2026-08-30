import { getAdminClient } from '@/lib/db/server';
import {
  getEvolutionGoGroupInfo,
  listEvolutionGoContacts,
  listEvolutionGoGroups,
  listEvolutionGoNewsletters,
} from '@/core/providers/whatsapp/evolution-go-client';
import {
  decryptProviderToken,
  loadCanonicalWhatsAppConfig,
  phoneFromWhatsAppJid,
} from '@/core/whatsapp/canonical-config';
import {
  extractWhatsAppGroupJid,
  extractWhatsAppGroupSubject,
  isPlaceholderContactName,
  isWhatsAppChannelJid,
  isWhatsAppGroupAddress,
  whatsappChatKind,
} from '@/core/whatsapp/group-identity';

const pendingLookups = new Set<string>();
const groupListCache = new Map<
  string,
  { at: number; groups: Array<{ jid: string; name: string }> }
>();
const newsletterListCache = new Map<
  string,
  { at: number; newsletters: Array<{ jid: string; name: string }> }
>();
const contactListCache = new Map<
  string,
  {
    at: number;
    contacts: Array<{ jid: string; name: string; saved: boolean }>;
  }
>();
const GROUP_LIST_CACHE_MS = 60_000;
const SYNC_TIMEOUT_MS = 6_000;
const INFO_CONCURRENCY = 4;
const MAX_LEFTOVER_LOOKUPS = 25;

export type InboxGroupNameContact = {
  phone?: string | null;
  name?: string | null;
  metadata?: Record<string, unknown> | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function collectiveJidForContact(contact: InboxGroupNameContact): string {
  const metaJid = String(contact.metadata?.whatsapp_jid || '').trim();
  if (metaJid.includes('@')) return metaJid;
  const phone = phoneFromWhatsAppJid(contact.phone || '');
  if (!phone) return '';
  const kind = whatsappChatKind(contact.phone, contact.metadata);
  if (kind === 'channel' || isWhatsAppChannelJid(metaJid)) {
    return `${phone}@newsletter`;
  }
  return `${phone}@g.us`;
}

async function mapPool<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  if (items.length === 0) return;
  let index = 0;
  const runners = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (index < items.length) {
        const current = items[index];
        index += 1;
        await worker(current);
      }
    }
  );
  await Promise.all(runners);
}

async function updateContactWhatsAppName(args: {
  accountId: string;
  phone: string;
  name: string;
  preferWhatsApp?: boolean;
}): Promise<boolean> {
  const { accountId, phone, name, preferWhatsApp = false } = args;
  if (!accountId || !phone || !name) return false;
  if (isPlaceholderContactName(name, phone)) return false;
  const db = getAdminClient();
  const existing = await db
    .from('contacts')
    .select('id, name, phone')
    .eq('account_id', accountId)
    .eq('phone', phone)
    .maybeSingle();
  if (existing.error || !existing.data) return false;
  const currentName = String((existing.data as { name?: string }).name || '');
  if (currentName === name) return false;
  const isCollective =
    isWhatsAppGroupAddress(phone) ||
    whatsappChatKind(phone) === 'channel' ||
    isWhatsAppChannelJid(String(phone));
  if (
    !preferWhatsApp &&
    !isCollective &&
    !isPlaceholderContactName(currentName, phone)
  ) {
    return false;
  }
  await db
    .from('contacts')
    .update({ name, updated_at: new Date().toISOString() })
    .eq('id', (existing.data as { id: string }).id)
    .eq('account_id', accountId);
  return true;
}

export async function applyEvolutionGroupNameEvent(
  accountId: string,
  payload: Record<string, unknown>
): Promise<void> {
  const data = asRecord(payload.data ?? payload.Data ?? payload.payload);
  const jid = extractWhatsAppGroupJid(data);
  const phone = phoneFromWhatsAppJid(jid);
  const name = extractWhatsAppGroupSubject(data);
  if (!phone || !name) return;
  await updateContactWhatsAppName({
    accountId,
    phone,
    name,
    preferWhatsApp: true,
  });
}

async function loadEvolutionGroups(
  accountId: string
): Promise<Array<{ jid: string; name: string }>> {
  const cached = groupListCache.get(accountId);
  if (cached && Date.now() - cached.at < GROUP_LIST_CACHE_MS) {
    return cached.groups;
  }
  const config = await loadCanonicalWhatsAppConfig(accountId);
  if (!config || config.providerKind !== 'evolution') return [];
  const token = decryptProviderToken(config);
  const groups = await listEvolutionGoGroups(token);
  groupListCache.set(accountId, { at: Date.now(), groups });
  return groups;
}

async function loadEvolutionToken(accountId: string): Promise<string | null> {
  const config = await loadCanonicalWhatsAppConfig(accountId);
  if (!config || config.providerKind !== 'evolution') return null;
  return decryptProviderToken(config);
}

async function rememberGroupName(
  accountId: string,
  names: Map<string, string>,
  phone: string,
  name: string
): Promise<void> {
  if (!phone || isPlaceholderContactName(name, phone)) return;
  names.set(phone, name);
  await updateContactWhatsAppName({
    accountId,
    phone,
    name,
    preferWhatsApp: true,
  });
}

async function fillGroupInfoNames(
  accountId: string,
  names: Map<string, string>,
  targets: Array<{ jid: string; phone: string }>
): Promise<void> {
  if (targets.length === 0) return;
  const token = await loadEvolutionToken(accountId);
  if (!token) return;
  await mapPool(targets, INFO_CONCURRENCY, async (target) => {
    if (names.has(target.phone)) return;
    try {
      const info = await getEvolutionGoGroupInfo(token, target.jid);
      await rememberGroupName(accountId, names, target.phone, info.name);
    } catch {
      // Best-effort. Inbox refresh retries.
    }
  });
}

export async function lookupEvolutionGroupName(
  accountId: string,
  groupAddress: string
): Promise<string> {
  const digits = phoneFromWhatsAppJid(groupAddress);
  if (!digits) return '';
  try {
    const listed = await loadEvolutionGroups(accountId);
    const fromList = listed.find(
      (group) => phoneFromWhatsAppJid(group.jid) === digits
    );
    if (fromList?.name && !isPlaceholderContactName(fromList.name, digits)) {
      return fromList.name;
    }
  } catch {
    // Fall through to /group/info.
  }
  const token = await loadEvolutionToken(accountId);
  if (!token) return '';
  const jid = groupAddress.includes('@') ? groupAddress : `${digits}@g.us`;
  const info = await getEvolutionGoGroupInfo(token, jid);
  return info.name;
}

async function loadEvolutionNewsletters(
  accountId: string
): Promise<Array<{ jid: string; name: string }>> {
  const cached = newsletterListCache.get(accountId);
  if (cached && Date.now() - cached.at < GROUP_LIST_CACHE_MS) {
    return cached.newsletters;
  }
  const token = await loadEvolutionToken(accountId);
  if (!token) return [];
  const newsletters = await listEvolutionGoNewsletters(token);
  newsletterListCache.set(accountId, { at: Date.now(), newsletters });
  return newsletters;
}

async function loadEvolutionContacts(
  accountId: string
): Promise<Array<{ jid: string; name: string; saved: boolean }>> {
  const cached = contactListCache.get(accountId);
  if (cached && Date.now() - cached.at < GROUP_LIST_CACHE_MS) {
    return cached.contacts;
  }
  const token = await loadEvolutionToken(accountId);
  if (!token) return [];
  const contacts = await listEvolutionGoContacts(token);
  contactListCache.set(accountId, { at: Date.now(), contacts });
  return contacts;
}

function findListedName(
  listed: Array<{ jid: string; name: string }>,
  address: string
): string {
  const digits = phoneFromWhatsAppJid(address);
  if (!digits) return '';
  const match = listed.find((row) => phoneFromWhatsAppJid(row.jid) === digits);
  if (!match?.name || isPlaceholderContactName(match.name, digits)) return '';
  return match.name;
}

export async function resolveEvolutionGroupName(
  accountId: string,
  groupAddress: string
): Promise<string> {
  try {
    const kind = whatsappChatKind(groupAddress);
    if (kind === 'channel' || isWhatsAppChannelJid(groupAddress)) {
      const name = findListedName(
        await loadEvolutionNewsletters(accountId),
        groupAddress
      );
      if (name) {
        await rememberGroupName(
          accountId,
          new Map(),
          phoneFromWhatsAppJid(groupAddress),
          name
        );
        return name;
      }
      return '';
    }
    if (kind === 'direct' && !isWhatsAppGroupAddress(groupAddress)) {
      const digits = phoneFromWhatsAppJid(groupAddress);
      const listed = await loadEvolutionContacts(accountId);
      const match = listed.find(
        (row) => phoneFromWhatsAppJid(row.jid) === digits
      );
      if (
        match?.name &&
        !isPlaceholderContactName(match.name, digits || groupAddress)
      ) {
        await updateContactWhatsAppName({
          accountId,
          phone: digits,
          name: match.name,
          preferWhatsApp: match.saved,
        });
        return match.name;
      }
      return '';
    }
    const name = await lookupEvolutionGroupName(accountId, groupAddress);
    if (name && !isPlaceholderContactName(name, groupAddress)) {
      await updateContactWhatsAppName({
        accountId,
        phone: phoneFromWhatsAppJid(groupAddress),
        name,
        preferWhatsApp: true,
      });
      return name;
    }
  } catch {
    // Keep the inbound path moving; inbox sync retries.
  }
  return '';
}

async function applyListedNames(
  accountId: string,
  names: Map<string, string>,
  listed: Array<{ jid: string; name: string }>,
  preferWhatsApp: boolean
): Promise<void> {
  const persist: Array<Promise<void>> = [];
  for (const row of listed) {
    const phone = phoneFromWhatsAppJid(row.jid);
    if (!phone || isPlaceholderContactName(row.name, phone)) continue;
    names.set(phone, row.name);
    persist.push(
      updateContactWhatsAppName({
        accountId,
        phone,
        name: row.name,
        preferWhatsApp,
      }).then(() => undefined)
    );
  }
  await Promise.all(persist);
}

async function collectEvolutionGroupNames(
  accountId: string,
  names: Map<string, string>,
  contacts: InboxGroupNameContact[]
): Promise<void> {
  const [groups, newsletters, savedContacts] = await Promise.all([
    loadEvolutionGroups(accountId).catch(() => []),
    loadEvolutionNewsletters(accountId).catch(() => []),
    loadEvolutionContacts(accountId).catch(() => []),
  ]);

  const unnamedListed: Array<{ jid: string; phone: string }> = [];
  for (const group of groups) {
    const phone = phoneFromWhatsAppJid(group.jid);
    if (!phone) continue;
    if (isPlaceholderContactName(group.name, phone)) {
      unnamedListed.push({ jid: group.jid, phone });
      continue;
    }
    names.set(phone, group.name);
  }
  await applyListedNames(accountId, names, groups, true);
  await applyListedNames(accountId, names, newsletters, true);
  for (const contact of savedContacts) {
    const phone = phoneFromWhatsAppJid(contact.jid);
    if (!phone || isPlaceholderContactName(contact.name, phone)) continue;
    if (contact.saved || !names.has(phone)) {
      names.set(phone, contact.name);
    }
  }
  await applyListedNames(
    accountId,
    names,
    savedContacts.filter((contact) => contact.saved),
    true
  );
  await applyListedNames(
    accountId,
    names,
    savedContacts.filter((contact) => !contact.saved),
    false
  );
  await fillGroupInfoNames(accountId, names, unnamedListed);

  const leftoverGroups = contacts
    .filter((contact) => {
      const phone = phoneFromWhatsAppJid(contact.phone || '');
      if (!phone || names.has(phone)) return false;
      const kind = whatsappChatKind(contact.phone, contact.metadata);
      if (kind !== 'group' && !isWhatsAppGroupAddress(contact.phone)) {
        return false;
      }
      return isPlaceholderContactName(contact.name, phone);
    })
    .slice(0, MAX_LEFTOVER_LOOKUPS)
    .map((contact) => {
      const phone = phoneFromWhatsAppJid(contact.phone || '');
      return { jid: collectiveJidForContact(contact), phone };
    })
    .filter((target) => target.jid && target.phone);

  await fillGroupInfoNames(accountId, names, leftoverGroups);
}

export async function syncEvolutionGroupNames(
  accountId: string
): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  if (!accountId) return names;
  await collectEvolutionGroupNames(accountId, names, []);
  return names;
}

export async function syncEvolutionGroupNamesForInbox(
  accountId: string,
  contacts: InboxGroupNameContact[] = []
): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  if (!accountId) return names;
  const work = collectEvolutionGroupNames(accountId, names, contacts).catch(
    () => undefined
  );
  await Promise.race([
    work,
    new Promise<void>((resolve) => setTimeout(resolve, SYNC_TIMEOUT_MS)),
  ]);
  return new Map(names);
}

export function scheduleEvolutionGroupNameRefresh(
  accountId: string,
  groupAddress: string
): void {
  const phone = phoneFromWhatsAppJid(groupAddress);
  if (!accountId || !phone) return;
  const key = `${accountId}:${phone}`;
  if (pendingLookups.has(key)) return;
  pendingLookups.add(key);
  void (async () => {
    try {
      const name = await lookupEvolutionGroupName(accountId, groupAddress);
      await updateContactWhatsAppName({
        accountId,
        phone,
        name,
        preferWhatsApp: true,
      });
    } catch {
      // Best-effort. Inbox sync retries on the next conversation list load.
    } finally {
      pendingLookups.delete(key);
    }
  })();
}
