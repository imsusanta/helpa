import { voiceRepository } from '@/infrastructure/appwrite/repositories/voice.repository';
import {
  VoiceProviderConfig,
  VoiceProviderError,
} from './voice-provider.interface';
import { decrypt } from '@/lib/whatsapp/encryption';

export interface ResolveConfigOptions {
  allowBootstrap?: boolean;
}

export interface DecryptedVoiceCredentials {
  apiKey: string;
  webhookSecret: string;
  agentId?: string;
  phoneNumberId?: string;
  keyVersion?: string;
}

/**
 * Server-only credential resolver for tenant-isolated voice configurations.
 *
 * Enforces strict security:
 * 1. Rejects plaintext JSON credential references.
 * 2. Decrypts references using authenticated AES-256-GCM server-side only.
 * 3. Never falls back to global environment credentials during production tenant requests.
 * 4. Sanitizes all error messages to prevent leaking account IDs or credential references.
 */
export async function resolveTenantVoiceConfig(
  accountId: string,
  provider: 'elevenlabs' | 'sarvam' | 'xai' = 'elevenlabs',
  options: ResolveConfigOptions = {}
): Promise<VoiceProviderConfig> {
  if (!accountId || typeof accountId !== 'string') {
    throw new VoiceProviderError(
      'VOICE_AUTHENTICATION_FAILED',
      'Account authentication is required',
      401
    );
  }

  const integration = await voiceRepository.findIntegration(
    accountId,
    provider
  );

  if (!integration) {
    // Explicit single-tenant bootstrap fallback for administration scripts only
    if (
      options.allowBootstrap &&
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
      'Voice provider is not configured for this account',
      404
    );
  }

  if (integration.status !== 'configured') {
    throw new VoiceProviderError(
      'VOICE_PROVIDER_NOT_CONFIGURED',
      'Voice integration is disabled or misconfigured',
      403
    );
  }

  const rawRef = integration.encryptedCredentialsReference;
  if (!rawRef || typeof rawRef !== 'string') {
    throw new VoiceProviderError(
      'VOICE_AUTHENTICATION_FAILED',
      'Missing tenant credentials reference',
      500
    );
  }

  // Reject unencrypted plaintext JSON references
  if (rawRef.trim().startsWith('{')) {
    throw new VoiceProviderError(
      'VOICE_AUTHENTICATION_FAILED',
      'Unencrypted credentials reference rejected',
      500
    );
  }

  let decryptedText: string;
  try {
    decryptedText = decrypt(rawRef);
  } catch {
    throw new VoiceProviderError(
      'VOICE_AUTHENTICATION_FAILED',
      'Failed to decrypt tenant voice credentials',
      500
    );
  }

  let credentials: DecryptedVoiceCredentials;
  try {
    credentials = JSON.parse(decryptedText);
  } catch {
    throw new VoiceProviderError(
      'VOICE_AUTHENTICATION_FAILED',
      'Malformed tenant voice credentials payload',
      500
    );
  }

  if (
    !credentials ||
    typeof credentials.apiKey !== 'string' ||
    !credentials.apiKey ||
    typeof credentials.webhookSecret !== 'string' ||
    !credentials.webhookSecret
  ) {
    throw new VoiceProviderError(
      'VOICE_PROVIDER_NOT_CONFIGURED',
      'Tenant voice integration is missing required credentials',
      503
    );
  }

  return {
    apiKey: credentials.apiKey,
    webhookSecret: credentials.webhookSecret,
    agentId:
      credentials.agentId ||
      integration.agentId ||
      process.env.ELEVENLABS_AGENT_ID,
    phoneNumberId:
      credentials.phoneNumberId ||
      integration.providerPhoneNumberId ||
      process.env.ELEVENLABS_PHONE_NUMBER_ID,
    baseUrl: process.env.ELEVENLABS_BASE_URL,
  };
}
