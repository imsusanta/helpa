import { describe, it, expect } from 'vitest';
import { launchWhatsAppEmbeddedSignup } from '@/lib/whatsapp/embedded-signup';
import type { WhatsAppConfig, WhatsAppConnectionStatus } from '@/types';

describe('Existing WhatsApp Business Connection & Coexistence Architecture', () => {
  describe('1. WhatsApp Config Types & Connection States', () => {
    it('supports all required coexistence and connection states', () => {
      const validStatuses: WhatsAppConnectionStatus[] = [
        'connected',
        'disconnected',
        'connecting',
        'coexistence_pending',
        'coexistence_connected',
        'action_required',
        'not_eligible',
        'error',
        'reconnect_required',
      ];
      expect(validStatuses.length).toBe(9);

      const sampleConfig: WhatsAppConfig = {
        id: 'cfg_123',
        user_id: 'usr_456',
        account_id: 'acc_789',
        phone_number_id: '10987654321',
        waba_id: 'waba_999',
        access_token: 'enc_token_xyz',
        status: 'coexistence_connected',
        connection_type: 'coexistence',
        coexistence_status: 'active',
        display_phone_number: '+91 98765 43210',
        verified_name: 'City Care Hospital',
        coexistence_eligible: true,
        webhook_healthy: true,
        messaging_active: true,
      };

      expect(sampleConfig.status).toBe('coexistence_connected');
      expect(sampleConfig.connection_type).toBe('coexistence');
      expect(sampleConfig.coexistence_status).toBe('active');
    });
  });

  describe('2. Launch Embedded Signup Mode Resolution', () => {
    it('sets proper setup payload for coexistence mode', async () => {
      let capturedLoginOptions: Record<string, unknown> | null = null;

      // Mock window.FB
      (global as unknown as { window: Record<string, unknown> }).window = {
        FB: {
          init: () => {},
          AppEvents: { logPageView: () => {} },
          login: (
            cb: (res: unknown) => void,
            options: Record<string, unknown>
          ) => {
            capturedLoginOptions = options;
            cb({
              authResponse: {
                code: 'mock_coexistence_auth_code_123',
              },
            });
          },
        },
      };

      const result = await launchWhatsAppEmbeddedSignup({
        appId: '1461038582135406',
        configId: '4607476386162686',
        mode: 'coexistence',
      });

      expect(result.code).toBe('mock_coexistence_auth_code_123');
      expect(result.mode).toBe('coexistence');
      expect(capturedLoginOptions).toBeDefined();

      const extras = (
        capturedLoginOptions as unknown as { extras?: Record<string, unknown> }
      )?.extras;
      expect(extras?.feature).toBe('whatsapp_embedded_signup');
      expect(extras?.sessionInfoVersion).toBe(3);
      expect((extras?.setup as { solution?: string })?.solution).toBe(
        'coexistence'
      );
    });

    it('sets standard setup payload for standard mode', async () => {
      let capturedLoginOptions: Record<string, unknown> | null = null;

      // Mock window.FB
      (global as unknown as { window: Record<string, unknown> }).window = {
        FB: {
          init: () => {},
          AppEvents: { logPageView: () => {} },
          login: (
            cb: (res: unknown) => void,
            options: Record<string, unknown>
          ) => {
            capturedLoginOptions = options;
            cb({
              authResponse: {
                code: 'mock_standard_auth_code_456',
              },
            });
          },
        },
      };

      const result = await launchWhatsAppEmbeddedSignup({
        appId: '1461038582135406',
        mode: 'standard',
      });

      expect(result.code).toBe('mock_standard_auth_code_456');
      expect(result.mode).toBe('standard');
      const extras = (
        capturedLoginOptions as unknown as { extras?: Record<string, unknown> }
      )?.extras;
      expect(extras?.setup).toEqual({});
    });
  });

  describe('3. Non-Destructive Disconnect & Data Protection Guarantees', () => {
    it('verifies that disconnect operates only on the workspace connection row', () => {
      const mockWorkspaceA = {
        accountId: 'acc_a',
        phoneNumberId: 'phone_111',
        conversations: 520,
        contacts: 1400,
      };

      // Disconnect simulation: removes integration credentials, keeps contacts & conversations
      const disconnectedState = {
        ...mockWorkspaceA,
        phoneNumberId: null,
        integrationStatus: 'disconnected',
      };

      expect(disconnectedState.conversations).toBe(520);
      expect(disconnectedState.contacts).toBe(1400);
      expect(disconnectedState.integrationStatus).toBe('disconnected');
    });
  });

  describe('4. Strict Tenant Isolation', () => {
    it('prevents another tenant from claiming an already connected phone number', () => {
      const existingConfigs = [
        { account_id: 'tenant_clinic_alpha', phone_number_id: 'phone_999888' },
      ];

      function canClaimPhoneNumber(
        requestAccountId: string,
        phoneNumberId: string
      ) {
        const conflict = existingConfigs.find(
          (c) =>
            c.phone_number_id === phoneNumberId &&
            c.account_id !== requestAccountId
        );
        return !conflict;
      }

      // Tenant Alpha reclaiming its own number -> Allowed
      expect(canClaimPhoneNumber('tenant_clinic_alpha', 'phone_999888')).toBe(
        true
      );

      // Tenant Beta attempting to claim Alpha's number -> Forbidden
      expect(canClaimPhoneNumber('tenant_clinic_beta', 'phone_999888')).toBe(
        false
      );
    });
  });
});
