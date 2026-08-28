/**
 * Resolves the tenant's canonical WhatsApp provider.
 *
 * Unknown providers fail closed. Meta, Evolution Go, and legacy WAHA
 * are the only supported kinds.
 */

import {
  loadCanonicalWhatsAppConfig,
  requireCanonicalWhatsAppConfig,
  decryptProviderToken,
  type CanonicalWhatsAppConfig,
  UnknownWhatsAppProviderError,
  WhatsAppNotConfiguredError,
} from '@/core/whatsapp/canonical-config';
import { EvolutionGoProvider } from '@/core/providers/whatsapp/evolution-go-provider';
import { WahaWhatsAppProvider } from '@/core/providers/whatsapp/waha-provider';
import type { WhatsAppProvider } from '@/core/providers/whatsapp/whatsapp-provider.interface';

export { UnknownWhatsAppProviderError, WhatsAppNotConfiguredError };

export type ResolvedWhatsAppProvider =
  | {
      kind: 'meta';
      config: CanonicalWhatsAppConfig;
      provider: null;
    }
  | {
      kind: 'evolution';
      config: CanonicalWhatsAppConfig;
      provider: EvolutionGoProvider;
    }
  | {
      kind: 'waha';
      config: CanonicalWhatsAppConfig;
      provider: WahaWhatsAppProvider;
    };

export async function resolveWhatsAppProvider(
  tenantId: string
): Promise<ResolvedWhatsAppProvider> {
  const config = await requireCanonicalWhatsAppConfig(tenantId);
  if (config.providerKind === 'meta') {
    return { kind: 'meta', config, provider: null };
  }
  if (config.providerKind === 'evolution') {
    const instanceToken = decryptProviderToken(config);
    return {
      kind: 'evolution',
      config,
      provider: new EvolutionGoProvider({
        accountId: config.accountId,
        instanceToken,
      }),
    };
  }
  if (config.providerKind === 'waha') {
    return {
      kind: 'waha',
      config,
      provider: new WahaWhatsAppProvider(),
    };
  }
  throw new UnknownWhatsAppProviderError(config.providerRaw);
}

export async function resolveWhatsAppProviderOrNull(
  tenantId: string
): Promise<ResolvedWhatsAppProvider | null> {
  const config = await loadCanonicalWhatsAppConfig(tenantId);
  if (!config) return null;
  return resolveWhatsAppProvider(tenantId);
}

export function assertMessagingProvider(
  resolved: ResolvedWhatsAppProvider
): WhatsAppProvider | null {
  return resolved.provider;
}
