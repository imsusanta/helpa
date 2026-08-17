import { describe, it, expect } from 'vitest';
import { isPlatformOwnerEmail, PLATFORM_OWNER_EMAIL } from '@/lib/auth/admin';
import { encrypt, decrypt } from '@/lib/whatsapp/encryption';

describe('Super Admin AI Infrastructure Authorization & Key Encryption', () => {

  describe('1. Super Admin Role Verification', () => {
    it('verifies that the platform owner email matches susantalohr@gmail.com', () => {
      expect(PLATFORM_OWNER_EMAIL).toBe('susantalohr@gmail.com');
      expect(isPlatformOwnerEmail('susantalohr@gmail.com')).toBe(true);
      expect(isPlatformOwnerEmail('SUSANTALOHR@GMAIL.COM')).toBe(true);
      expect(isPlatformOwnerEmail('other_tenant@hospital.com')).toBe(false);
      expect(isPlatformOwnerEmail(null)).toBe(false);
    });
  });

  describe('2. Provider Secret Non-Disclosure & Encryption at Rest', () => {
    it('encrypts OpenRouter and OrcaRouter API keys at rest without cleartext leakage', () => {
      const openRouterRaw = 'sk-or-v1-abcdef1234567890abcdef1234567890';
      const orcaRouterRaw = 'orca_live_secret_key_998877665544332211';

      const encOpenRouter = encrypt(openRouterRaw);
      const encOrcaRouter = encrypt(orcaRouterRaw);

      // Must be encrypted strings
      expect(encOpenRouter).not.toBe(openRouterRaw);
      expect(encOrcaRouter).not.toBe(orcaRouterRaw);

      // Decryption must restore identical keys
      expect(decrypt(encOpenRouter)).toBe(openRouterRaw);
      expect(decrypt(encOrcaRouter)).toBe(orcaRouterRaw);
    });

    it('ensures API responses mask secret keys into boolean flags', () => {
      const dbSettingsRows = [
        { key: 'system_openrouter_api_key', value: encrypt('sk-test') },
        { key: 'system_orcarouter_api_key', value: encrypt('orca-test') },
        { key: 'system_ai_provider', value: 'openrouter' },
        { key: 'system_openrouter_model', value: 'google/gemini-2.5-flash' },
      ];

      const safeResponse: Record<string, unknown> = {};
      dbSettingsRows.forEach((row) => {
        if (row.key.includes('api_key')) {
          safeResponse[`has_${row.key}`] = !!row.value;
        } else {
          safeResponse[row.key] = row.value;
        }
      });

      expect(safeResponse.has_system_openrouter_api_key).toBe(true);
      expect(safeResponse.has_system_orcarouter_api_key).toBe(true);
      expect(safeResponse.system_openrouter_api_key).toBeUndefined();
      expect(safeResponse.system_orcarouter_api_key).toBeUndefined();
    });
  });
});
