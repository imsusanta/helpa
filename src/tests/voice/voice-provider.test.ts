import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'node:crypto';
import { ElevenLabsVoiceProvider } from '@/core/providers/voice/elevenlabs-provider';
import { SarvamVoiceProvider } from '@/core/providers/voice/sarvam-provider';
import { XAiVoiceProvider } from '@/core/providers/voice/xai-provider';
import { VoiceProviderError } from '@/core/providers/voice/voice-provider.interface';

describe('Voice Providers Contract & Security', () => {
  const mockApiKey = 'test_elevenlabs_api_key_12345';
  const mockWebhookSecret = 'test_webhook_secret_67890';
  const mockAgentId = 'agent_elevenlabs_1';
  const mockPhoneId = 'phone_elevenlabs_1';

  let elevenlabs: ElevenLabsVoiceProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    elevenlabs = new ElevenLabsVoiceProvider({
      apiKey: mockApiKey,
      webhookSecret: mockWebhookSecret,
      agentId: mockAgentId,
      phoneNumberId: mockPhoneId,
    });
  });

  describe('ElevenLabsVoiceProvider', () => {
    it('throws VOICE_PROVIDER_NOT_CONFIGURED when API key is missing', async () => {
      const unconfigured = new ElevenLabsVoiceProvider({});
      await expect(unconfigured.validateConfiguration()).rejects.toThrow(
        VoiceProviderError
      );
      await expect(unconfigured.validateConfiguration()).rejects.toHaveProperty(
        'code',
        'VOICE_PROVIDER_NOT_CONFIGURED'
      );
    });

    it('rejects webhooks with missing signature header', async () => {
      const headers = new Headers();
      await expect(
        elevenlabs.verifyWebhook('{"type":"call_started"}', headers)
      ).rejects.toHaveProperty('code', 'VOICE_SIGNATURE_INVALID');
    });

    it('rejects webhooks outside the replay window', async () => {
      const oldTimestamp = Math.floor(Date.now() / 1000) - 600; // 10 minutes ago
      const body = '{"type":"call_started"}';
      const sig = crypto
        .createHmac('sha256', mockWebhookSecret)
        .update(`${oldTimestamp}.${body}`)
        .digest('hex');

      const headers = new Headers({
        'elevenlabs-signature': `t=${oldTimestamp},v0=${sig}`,
      });

      await expect(
        elevenlabs.verifyWebhook(body, headers)
      ).rejects.toHaveProperty('code', 'VOICE_REPLAY_DETECTED');
    });

    it('verifies valid HMAC webhook signature within replay window', async () => {
      const nowTimestamp = Math.floor(Date.now() / 1000);
      const body = JSON.stringify({
        type: 'call_initiation_success',
        data: {
          conversation_id: 'conv_123',
          agent_id: mockAgentId,
          status: 'in-progress',
          metadata: { start_time_unix_secs: nowTimestamp },
        },
      });
      const sig = crypto
        .createHmac('sha256', mockWebhookSecret)
        .update(`${nowTimestamp}.${body}`)
        .digest('hex');

      const headers = new Headers({
        'elevenlabs-signature': `t=${nowTimestamp},v0=${sig}`,
      });

      const res = await elevenlabs.verifyWebhook(body, headers);
      expect(res.verified).toBe(true);
      expect(res.timestamp).toBe(nowTimestamp);
    });

    it('normalizes valid ElevenLabs webhook payload', async () => {
      const body = JSON.stringify({
        type: 'call_initiation_success',
        data: {
          conversation_id: 'conv_abc_789',
          agent_id: mockAgentId,
          status: 'in-progress',
          metadata: {
            start_time_unix_secs: 1700000000,
            call_duration_secs: 45,
          },
          analysis: {
            transcript_summary: 'Patient scheduled appointment for Monday.',
          },
        },
      });

      const normalized = await elevenlabs.normalizeWebhook(body);
      expect(normalized.externalCallId).toBe('conv_abc_789');
      expect(normalized.externalAgentId).toBe(mockAgentId);
      expect(normalized.status).toBe('in_progress');
      expect(normalized.summary).toBe(
        'Patient scheduled appointment for Monday.'
      );
    });

    it('calls official /convai/sip-trunk/outbound endpoint when initiating outbound calls', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            success: true,
            conversation_id: 'conv_official_123',
          }),
      } as Response);

      const res = await elevenlabs.initiateOutboundCall({
        toNumber: '+18005550199',
        agentId: mockAgentId,
        phoneNumberId: mockPhoneId,
      });

      expect(res.externalCallId).toBe('conv_official_123');
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.elevenlabs.io/v1/convai/sip-trunk/outbound-call',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    it('returns VOICE_OPERATION_UNSUPPORTED for unsupported transfer & terminate', async () => {
      await expect(elevenlabs.transferCall()).rejects.toHaveProperty(
        'code',
        'VOICE_OPERATION_UNSUPPORTED'
      );
      await expect(elevenlabs.terminateCall()).rejects.toHaveProperty(
        'code',
        'VOICE_OPERATION_UNSUPPORTED'
      );
    });
  });

  describe('SarvamVoiceProvider (Unsupported Telephony)', () => {
    it('returns VOICE_OPERATION_UNSUPPORTED for all telephony calls', async () => {
      const sarvam = new SarvamVoiceProvider();
      await expect(sarvam.validateConfiguration()).rejects.toHaveProperty(
        'code',
        'VOICE_OPERATION_UNSUPPORTED'
      );
      await expect(
        sarvam.initiateOutboundCall({ toNumber: '+18005550199' })
      ).rejects.toHaveProperty('code', 'VOICE_OPERATION_UNSUPPORTED');
    });
  });

  describe('XAiVoiceProvider (Unsupported Telephony / Fail Closed)', () => {
    it('returns VOICE_OPERATION_UNSUPPORTED for all telephony operations', async () => {
      const xai = new XAiVoiceProvider();
      await expect(xai.validateConfiguration()).rejects.toHaveProperty(
        'code',
        'VOICE_OPERATION_UNSUPPORTED'
      );
      await expect(
        xai.initiateOutboundCall({ toNumber: '+18005550199' })
      ).rejects.toHaveProperty('code', 'VOICE_OPERATION_UNSUPPORTED');
    });

    it('reports health as not configured and un-reachable', async () => {
      const xai = new XAiVoiceProvider();
      const health = await xai.healthCheck();
      expect(health.configured).toBe(false);
      expect(health.credentialsValid).toBe(false);
      expect(health.providerReachable).toBe(false);
    });
  });
});
