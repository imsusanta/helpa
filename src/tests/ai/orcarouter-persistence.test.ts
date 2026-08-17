import { describe, it, expect } from 'vitest';
import { encrypt, decrypt } from '@/lib/whatsapp/encryption';

describe('OrcaRouter & AI Provider Dual-Layer Persistence', () => {

  it('encrypts and decrypts OrcaRouter API keys securely', () => {
    const rawKey = 'orca_live_sk_test_1234567890abcdef';
    const encrypted = encrypt(rawKey);

    expect(encrypted).not.toBe(rawKey);
    expect(encrypted.length).toBeGreaterThan(20);

    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(rawKey);
  });

  it('correctly maps account-specific system_settings keys for fallback persistence', () => {
    const accountId = 'acc_test_workspace_99';
    const sysRows = [
      { key: `account:${accountId}:orcarouter_api_key`, value: encrypt('orca_live_test_key') },
      { key: `account:${accountId}:orcarouter_model`, value: 'orcarouter/auto' },
      { key: `account:${accountId}:ai_provider`, value: 'orcarouter' },
    ];

    const sysMap: Record<string, string> = {};
    sysRows.forEach((r) => {
      const fieldName = r.key.replace(`account:${accountId}:`, '');
      sysMap[fieldName] = r.value;
    });

    expect(sysMap.orcarouter_model).toBe('orcarouter/auto');
    expect(sysMap.ai_provider).toBe('orcarouter');
    expect(decrypt(sysMap.orcarouter_api_key)).toBe('orca_live_test_key');
  });
});
