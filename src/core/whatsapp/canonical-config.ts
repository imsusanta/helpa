/**
 * Canonical WhatsApp configuration loader and provider classification.
 *
 * Provider selection is always based on the server-side row. Unknown
 * provider values fail closed and are never silently mapped to Meta.
 */

import { getAdminClient } from '@/lib/db/server';
import { decrypt } from '@/lib/whatsapp/encryption';
import type { WhatsAppProviderName } from '@/core/providers/whatsapp/whatsapp-provider.interface';

const META_PROVIDERS = new Set([
  'meta',
  'meta_embedded_signup',
  'meta_manual_config',
  'meta_cloud',
  'cloud_api',
]);

export class WhatsAppNotConfiguredError extends Error {
  readonly code = 'WHATSAPP_NOT_CONFIGURED';
  constructor(message = 'WhatsApp is not configured for this workspace.') {
    super(message);
    this.name = 'WhatsAppNotConfiguredError';
  }
}

export class UnknownWhatsAppProviderError extends Error {
  readonly code = 'UNKNOWN_WHATSAPP_PROVIDER';
  readonly provider: string;
  constructor(provider: string) {
    super(
      `WhatsApp provider "${provider}" is not supported for this workspace.`
    );
    this.name = 'UnknownWhatsAppProviderError';
    this.provider = provider;
  }
}

export interface CanonicalWhatsAppConfig {
  id: string;
  accountId: string;
  providerRaw: string;
  providerKind: WhatsAppProviderName;
  phoneNumberId: string;
  wabaId: string;
  encryptedAccessToken: string;
  providerInstanceId: string;
  providerInstanceName: string;
  providerTokenEncrypted: string;
  webhookSecretHash: string;
  status: string;
  connectionStatus: string;
  displayPhoneNumber: string;
  verifiedName: string;
  connectionError: string;
  source: 'whatsapp_configs' | 'whatsapp_config';
  raw: Record<string, unknown>;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function classifyWhatsAppProvider(
  raw: unknown
): WhatsAppProviderName | 'unknown' {
  const value = asString(raw).toLowerCase();
  if (!value) {
    // Historical Meta rows and test fixtures omit provider. The database
    // default is meta_embedded_signup; absence is treated as Meta.
    return 'meta';
  }
  if (META_PROVIDERS.has(value)) return 'meta';
  if (value === 'evolution' || value === 'evolution_go') return 'evolution';
  if (value === 'waha') return 'waha';
  return 'unknown';
}

function mapRow(
  row: Record<string, unknown>,
  source: CanonicalWhatsAppConfig['source']
): CanonicalWhatsAppConfig {
  const providerRaw =
    asString(row.provider) ||
    (source === 'whatsapp_config' ? 'meta' : 'meta_embedded_signup');
  const providerKind = classifyWhatsAppProvider(providerRaw);
  if (providerKind === 'unknown') {
    throw new UnknownWhatsAppProviderError(providerRaw);
  }
  return {
    id: asString(row.id),
    accountId: asString(row.account_id || row.accountId),
    providerRaw,
    providerKind,
    phoneNumberId: asString(row.phone_number_id || row.phoneNumberId),
    wabaId: asString(row.waba_id || row.wabaId),
    encryptedAccessToken: asString(
      row.encrypted_access_token ||
        row.access_token_encrypted ||
        row.encryptedAccessToken ||
        row.access_token ||
        row.accessToken
    ),
    providerInstanceId: asString(
      row.provider_instance_id || row.providerInstanceId
    ),
    providerInstanceName: asString(
      row.provider_instance_name || row.providerInstanceName
    ),
    providerTokenEncrypted: asString(
      row.provider_token_encrypted ||
        row.providerTokenEncrypted ||
        row.encrypted_access_token ||
        row.access_token_encrypted
    ),
    webhookSecretHash: asString(
      row.webhook_secret_hash || row.webhookSecretHash
    ),
    status: asString(row.status) || 'disconnected',
    connectionStatus: asString(
      row.connection_status || row.connectionStatus || row.status
    ),
    displayPhoneNumber: asString(
      row.display_phone_number || row.phone_number || row.displayPhoneNumber
    ),
    verifiedName: asString(row.verified_name || row.business_name),
    connectionError: asString(row.connection_error || row.connectionError),
    source,
    raw: row,
  };
}

export async function loadCanonicalWhatsAppConfig(
  accountId: string
): Promise<CanonicalWhatsAppConfig | null> {
  if (!accountId) return null;
  const db = getAdminClient();

  try {
    const { data, error } = await db
      .from('whatsapp_configs')
      .select('*')
      .eq('account_id', accountId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!error && data) {
      return mapRow(data as Record<string, unknown>, 'whatsapp_configs');
    }
  } catch {
    // Canonical table may be unavailable in older test doubles.
  }

  try {
    const { data, error } = await db
      .from('whatsapp_config')
      .select('*')
      .eq('account_id', accountId)
      .limit(1)
      .maybeSingle();
    if (!error && data) {
      return mapRow(data as Record<string, unknown>, 'whatsapp_config');
    }
  } catch {
    // Legacy table is optional.
  }

  return null;
}

export async function requireCanonicalWhatsAppConfig(
  accountId: string
): Promise<CanonicalWhatsAppConfig> {
  const config = await loadCanonicalWhatsAppConfig(accountId);
  if (!config) throw new WhatsAppNotConfiguredError();
  return config;
}

export function decryptProviderToken(config: CanonicalWhatsAppConfig): string {
  const ciphertext =
    config.providerKind === 'evolution'
      ? config.providerTokenEncrypted || config.encryptedAccessToken
      : config.encryptedAccessToken;
  if (!ciphertext) {
    throw new WhatsAppNotConfiguredError(
      'WhatsApp credentials are missing for this workspace.'
    );
  }
  try {
    return decrypt(ciphertext);
  } catch {
    if (ciphertext.includes(':')) {
      throw new WhatsAppNotConfiguredError(
        'Stored WhatsApp credentials could not be decrypted. Reconnect WhatsApp.'
      );
    }
    return ciphertext;
  }
}

export function phoneFromWhatsAppJid(jid: string | undefined | null): string {
  const raw = String(jid || '').trim();
  if (!raw) return '';
  const user = raw.split('@')[0] || '';
  const number = user.split(':')[0] || '';
  return number.replace(/\D/g, '');
}

export function evolutionPhoneNumberId(instanceId: string): string {
  return `evolution:${instanceId}`;
}

export function isMetaLiveConfig(config: CanonicalWhatsAppConfig): boolean {
  if (config.providerKind !== 'meta') return false;
  const status = config.status.toLowerCase();
  return status === 'connected' || status === 'coexistence_connected';
}
