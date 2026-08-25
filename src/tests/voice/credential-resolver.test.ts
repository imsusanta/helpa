import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveTenantVoiceConfig } from '@/core/providers/voice/credential-resolver';
import { voiceRepository } from '@/lib/db/repositories';
import { encrypt } from '@/lib/whatsapp/encryption';
import { VoiceProviderError } from '@/core/providers/voice/voice-provider.interface';

vi.mock('@/lib/db/repositories', () => ({
  voiceRepository: {
    findIntegration: vi.fn(),
  },
}));

describe('Voice Credential Resolver Security & Isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves and decrypts valid encrypted tenant credentials', async () => {
    const credsObj = {
      apiKey: 'tenant_api_key_abc',
      webhookSecret: 'tenant_secret_xyz',
      agentId: 'agent_tenant_1',
      phoneNumberId: 'phone_tenant_1',
    };
    const encryptedRef = encrypt(JSON.stringify(credsObj));

    vi.mocked(voiceRepository.findIntegration).mockResolvedValueOnce({
      $id: 'integration_1',
      accountId: 'account_tenant_a',
      provider: 'elevenlabs',
      encryptedCredentialsReference: encryptedRef,
      agentId: 'agent_tenant_1',
      providerPhoneNumberId: 'phone_tenant_1',
      status: 'configured',
    });

    const config = await resolveTenantVoiceConfig(
      'account_tenant_a',
      'elevenlabs'
    );
    expect(config.apiKey).toBe('tenant_api_key_abc');
    expect(config.webhookSecret).toBe('tenant_secret_xyz');
    expect(config.agentId).toBe('agent_tenant_1');
  });

  it('rejects unencrypted plaintext JSON credential references starting with {', async () => {
    vi.mocked(voiceRepository.findIntegration).mockResolvedValueOnce({
      $id: 'integration_2',
      accountId: 'account_tenant_b',
      provider: 'elevenlabs',
      encryptedCredentialsReference: '{"apiKey":"unencrypted"}',
      agentId: 'agent_2',
      providerPhoneNumberId: 'phone_2',
      status: 'configured',
    });

    await expect(
      resolveTenantVoiceConfig('account_tenant_b', 'elevenlabs')
    ).rejects.toThrowError(VoiceProviderError);
  });

  it('does not fall back to global environment credentials in production tenant requests', async () => {
    vi.mocked(voiceRepository.findIntegration).mockResolvedValueOnce(null);

    await expect(
      resolveTenantVoiceConfig('account_tenant_c', 'elevenlabs')
    ).rejects.toThrowError(VoiceProviderError);
  });

  it('enforces strict tenant isolation: Tenant A can never receive Tenant B credentials', async () => {
    const credsB = {
      apiKey: 'tenant_B_key',
      webhookSecret: 'tenant_B_secret',
    };
    const encryptedRefB = encrypt(JSON.stringify(credsB));

    vi.mocked(voiceRepository.findIntegration).mockImplementation(
      async (accId) => {
        if (accId === 'account_b') {
          return {
            $id: 'integration_b',
            accountId: 'account_b',
            provider: 'elevenlabs',
            encryptedCredentialsReference: encryptedRefB,
            agentId: 'agent_b',
            providerPhoneNumberId: 'phone_b',
            status: 'configured',
          };
        }
        return null;
      }
    );

    await expect(
      resolveTenantVoiceConfig('account_a', 'elevenlabs')
    ).rejects.toHaveProperty('code', 'VOICE_PROVIDER_NOT_CONFIGURED');
  });
});
