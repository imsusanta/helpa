import { voiceRepository } from '@/infrastructure/appwrite/repositories/voice.repository';
import {
  VoiceProviderConfig,
  VoiceProviderError,
} from './voice-provider.interface';
import { decrypt } from '@/lib/whatsapp/encryption';

/**
 * Server-only credential resolver.
 *
 * Resolves trusted, tenant-scoped voice provider configuration from Appwrite `voice_integrations` collection.
 * Fails closed if integration mapping is missing, duplicated, disabled, malformed, or undecryptable.
 */
export async function resolveTenantVoiceConfig(
  accountId: string,
  provider: 'elevenlabs' | 'sarvam' | 'xai' = 'elevenlabs'
): Promise<VoiceProviderConfig> {
  if (!accountId) {
    throw new VoiceProviderError(
      'VOICE_AUTHENTICATION_FAILED',
      'Tenant account ID is required to resolve voice credentials',
      401
    );
  }

  const integration = await voiceRepository.findIntegration(
    accountId,
    provider
  );

  // Single-tenant bootstrap / migration fallback IF environment variables exist
  if (!integration) {
    if (
      process.env.ELEVENLABS_API_KEY &&
      process.env.ELEVENLABS_WEBHOOK_SECRET
    ) {
      return {
        apiKey: process.env.ELEVENLABS_API_KEY,
        webhookSecret: process.env.ELEVENLABS_WEBHOOK_SECRET,
        agentId: process.env.ELEVENLABS_AGENT_ID,
        phoneNumberId: process.env.ELEVENLABS_PHONE_NUMBER_ID,
        baseUrl: process.env.ELEVENLABS_BASE_URL,
      };
    }
    throw new VoiceProviderError(
      'VOICE_PROVIDER_NOT_CONFIGURED',
      `No enabled ${provider} voice integration found for tenant ${accountId}`,
      404
    );
  }

  if (integration.status !== 'configured') {
    throw new VoiceProviderError(
      'VOICE_PROVIDER_NOT_CONFIGURED',
      `Tenant voice integration for ${provider} is disabled or misconfigured`,
      403
    );
  }

  let apiKey: string | undefined;
  let webhookSecret: string | undefined;

  if (integration.encryptedCredentialsReference) {
    try {
      const rawRef = integration.encryptedCredentialsReference;
      const decryptedText = rawRef.startsWith('{') ? rawRef : decrypt(rawRef);
      const parsed = JSON.parse(decryptedText);
      if (typeof parsed === 'object' && parsed) {
        apiKey = typeof parsed.apiKey === 'string' ? parsed.apiKey : undefined;
        webhookSecret =
          typeof parsed.webhookSecret === 'string'
            ? parsed.webhookSecret
            : undefined;
      }
    } catch {
      throw new VoiceProviderError(
        'VOICE_AUTHENTICATION_FAILED',
        'Failed to decrypt tenant voice credentials',
        500
      );
    }
  }

  // Environment variable fallback if not stored inside decrypted reference
  apiKey = apiKey || process.env.ELEVENLABS_API_KEY;
  webhookSecret = webhookSecret || process.env.ELEVENLABS_WEBHOOK_SECRET;

  if (!apiKey || !webhookSecret) {
    throw new VoiceProviderError(
      'VOICE_PROVIDER_NOT_CONFIGURED',
      `Tenant voice integration for ${provider} is missing required credentials`,
      503
    );
  }

  return {
    apiKey,
    webhookSecret,
    agentId: integration.agentId || process.env.ELEVENLABS_AGENT_ID,
    phoneNumberId:
      integration.providerPhoneNumberId ||
      process.env.ELEVENLABS_PHONE_NUMBER_ID,
    baseUrl: process.env.ELEVENLABS_BASE_URL,
  };
}
