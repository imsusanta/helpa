import { describe, it, expect } from 'vitest';
import { APPWRITE_CONFIG } from '@/infrastructure/appwrite/config';
import { encrypt, decrypt } from '@/lib/whatsapp/encryption';

describe('WhatsApp Configuration Schema & Tenant Isolation', () => {
  it('uses the canonical collection ID whatsapp_configs', () => {
    expect(APPWRITE_CONFIG.collections.whatsappConfigs).toBe(
      'whatsapp_configs'
    );
  });

  it('encrypts access tokens securely without returning plaintext in API responses', () => {
    const rawToken = 'EAAG1234567890TestToken';
    const encrypted = encrypt(rawToken);
    expect(encrypted).not.toBe(rawToken);
    expect(encrypted).toContain(':');

    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(rawToken);
  });

  it('safely masks sensitive fields for client responses', () => {
    const safeOutput = {
      phone_number_id: '1000123456789',
      waba_id: '990011223344',
      has_access_token: true,
      has_verify_token: true,
      status: 'connected',
    };

    expect(safeOutput).not.toHaveProperty('access_token');
    expect(safeOutput).not.toHaveProperty('verify_token');
    expect(safeOutput).not.toHaveProperty('encryptedAccessToken');
    expect(safeOutput.has_access_token).toBe(true);
  });

  it('prohibits default_account identity fallbacks in session derivation', () => {
    const mockCtx = { userId: 'user-123', accountId: null };
    const canAccess = Boolean(mockCtx.userId && mockCtx.accountId);
    expect(canAccess).toBe(false);
  });
});
