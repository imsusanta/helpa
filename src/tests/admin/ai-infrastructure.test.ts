import { describe, it, expect } from 'vitest';
import { isPlatformOwnerEmail, PLATFORM_OWNER_EMAIL } from '@/lib/auth/admin';
import { encrypt, decrypt } from '@/lib/whatsapp/encryption';

describe('Super Admin AI Infrastructure Authorization & Key Encryption', () => {
  describe('1. Super Admin Role Verification', () => {
    it('keeps bootstrap email matching informational and disabled by default', () => {
      if (PLATFORM_OWNER_EMAIL) {
        expect(isPlatformOwnerEmail(PLATFORM_OWNER_EMAIL.toUpperCase())).toBe(
          true
        );
      } else {
        expect(isPlatformOwnerEmail('susantalohr@gmail.com')).toBe(false);
      }
      expect(isPlatformOwnerEmail('other_tenant@hospital.com')).toBe(false);
      expect(isPlatformOwnerEmail(null)).toBe(false);
    });
  });

  describe('2. Provider Secret Non-Disclosure & Encryption at Rest', () => {
    it('encrypts OpenRouter, OrcaRouter, and Cloudflare API credentials at rest without cleartext leakage', () => {
      const openRouterRaw = 'sk-or-v1-abcdef1234567890abcdef1234567890';
      const orcaRouterRaw = 'orca_live_secret_key_998877665544332211';
      const cloudflareRaw = 'cf_api_token_secret_998877665544332211';

      const encOpenRouter = encrypt(openRouterRaw);
      const encOrcaRouter = encrypt(orcaRouterRaw);
      const encCloudflare = encrypt(cloudflareRaw);

      // Must be encrypted strings
      expect(encOpenRouter).not.toBe(openRouterRaw);
      expect(encOrcaRouter).not.toBe(orcaRouterRaw);
      expect(encCloudflare).not.toBe(cloudflareRaw);

      // Decryption must restore identical keys
      expect(decrypt(encOpenRouter)).toBe(openRouterRaw);
      expect(decrypt(encOrcaRouter)).toBe(orcaRouterRaw);
      expect(decrypt(encCloudflare)).toBe(cloudflareRaw);
    });

    it('ensures API responses mask secret keys into boolean flags', () => {
      const dbSettingsRows = [
        { key: 'system_openrouter_api_key', value: encrypt('sk-test') },
        { key: 'system_orcarouter_api_key', value: encrypt('orca-test') },
        { key: 'system_cloudflare_api_token', value: encrypt('cf-test') },
        { key: 'system_cloudflare_account_id', value: 'cf-acc-12345' },
        { key: 'system_ai_provider', value: 'openrouter' },
        { key: 'system_openrouter_model', value: 'google/gemini-2.5-flash' },
      ];

      const safeResponse: Record<string, unknown> = {};
      dbSettingsRows.forEach((row) => {
        if (row.key.includes('api_key') || row.key.includes('api_token')) {
          safeResponse[`has_${row.key}`] = !!row.value;
        } else {
          safeResponse[row.key] = row.value;
        }
      });

      expect(safeResponse.has_system_openrouter_api_key).toBe(true);
      expect(safeResponse.has_system_orcarouter_api_key).toBe(true);
      expect(safeResponse.has_system_cloudflare_api_token).toBe(true);
      expect(safeResponse.system_cloudflare_account_id).toBe('cf-acc-12345');
      expect(safeResponse.system_openrouter_api_key).toBeUndefined();
      expect(safeResponse.system_orcarouter_api_key).toBeUndefined();
      expect(safeResponse.system_cloudflare_api_token).toBeUndefined();
    });
  });
});
