import { getAdminClient } from '@/lib/db/server';
import { getEvolutionGoGroupInfo } from '@/core/providers/whatsapp/evolution-go-client';
import {
  decryptProviderToken,
  loadCanonicalWhatsAppConfig,
  phoneFromWhatsAppJid,
} from '@/core/whatsapp/canonical-config';
import {
  extractWhatsAppGroupJid,
  extractWhatsAppGroupSubject,
  isPlaceholderContactName,
  isWhatsAppGroupAddress,
} from '@/core/whatsapp/group-identity';

const pendingLookups = new Set<string>();

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

async function updateContactNameIfPlaceholder(args: {
  accountId: string;
  phone: string;
  name: string;
}): Promise<void> {
  const { accountId, phone, name } = args;
  if (!accountId || !phone || !name) return;
  if (isPlaceholderContactName(name, phone)) return;
  const db = getAdminClient();
  const existing = await db
    .from('contacts')
    .select('id, name, phone')
    .eq('account_id', accountId)
    .eq('phone', phone)
    .maybeSingle();
  if (existing.error || !existing.data) return;
  const currentName = String((existing.data as { name?: string }).name || '');
  if (!isPlaceholderContactName(currentName, phone)) return;
  await db
    .from('contacts')
    .update({ name, updated_at: new Date().toISOString() })
    .eq('id', (existing.data as { id: string }).id)
    .eq('account_id', accountId);
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

export async function lookupEvolutionGroupName(
  accountId: string,
  groupAddress: string
): Promise<string> {
  const config = await loadCanonicalWhatsAppConfig(accountId);
  if (!config || config.providerKind !== 'evolution') return '';
  const token = decryptProviderToken(config);
  const digits = phoneFromWhatsAppJid(groupAddress);
  const jid = isWhatsAppGroupAddress(groupAddress)
    ? groupAddress.includes('@')
      ? groupAddress
      : `${digits}@g.us`
    : `${digits}@g.us`;
  const info = await getEvolutionGoGroupInfo(token, jid);
  return info.name;
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
      // Best-effort. Inbox already shows the fallback group label.
    } finally {
      pendingLookups.delete(key);
    }
  })();
}
