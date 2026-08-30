import { getAdminClient } from '@/lib/db/server';
import {
  getEvolutionGoGroupInfo,
  listEvolutionGoGroups,
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
} from '@/core/whatsapp/group-identity';

const pendingLookups = new Set<string>();
const groupListCache = new Map<
  string,
  { at: number; groups: Array<{ jid: string; name: string }> }
>();
const GROUP_LIST_CACHE_MS = 60_000;
const SYNC_TIMEOUT_MS = 2_500;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

async function updateContactNameIfPlaceholder(args: {
  accountId: string;
  phone: string;
  name: string;
}): Promise<boolean> {
  const { accountId, phone, name } = args;
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
  if (!isPlaceholderContactName(currentName, phone)) return false;
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
  await updateContactNameIfPlaceholder({ accountId, phone, name });
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
  const config = await loadCanonicalWhatsAppConfig(accountId);
  if (!config || config.providerKind !== 'evolution') return '';
  const token = decryptProviderToken(config);
  const jid = groupAddress.includes('@') ? groupAddress : `${digits}@g.us`;
  const info = await getEvolutionGoGroupInfo(token, jid);
  return info.name;
}

export async function resolveEvolutionGroupName(
  accountId: string,
  groupAddress: string
): Promise<string> {
  try {
    const name = await lookupEvolutionGroupName(accountId, groupAddress);
    if (name && !isPlaceholderContactName(name, groupAddress)) {
      await updateContactNameIfPlaceholder({
        accountId,
        phone: phoneFromWhatsAppJid(groupAddress),
        name,
      });
      return name;
    }
  } catch {
    // Keep the inbound path moving; inbox sync retries.
  }
  return '';
}

export async function syncEvolutionGroupNames(
  accountId: string
): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  if (!accountId) return names;
  const groups = await loadEvolutionGroups(accountId);
  for (const group of groups) {
    const phone = phoneFromWhatsAppJid(group.jid);
    if (!phone || isPlaceholderContactName(group.name, phone)) continue;
    names.set(phone, group.name);
    await updateContactNameIfPlaceholder({
      accountId,
      phone,
      name: group.name,
    });
  }
  return names;
}

export async function syncEvolutionGroupNamesForInbox(
  accountId: string
): Promise<Map<string, string>> {
  try {
    return await Promise.race([
      syncEvolutionGroupNames(accountId),
      new Promise<Map<string, string>>((resolve) =>
        setTimeout(() => resolve(new Map()), SYNC_TIMEOUT_MS)
      ),
    ]);
  } catch {
    return new Map();
  }
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
      await updateContactNameIfPlaceholder({ accountId, phone, name });
    } catch {
      // Best-effort. Inbox sync retries on the next conversation list load.
    } finally {
      pendingLookups.delete(key);
    }
  })();
}
