import { describe, expect, it } from 'vitest';
import { decrypt, isLegacyFormat } from './encryption';

describe('encryption compatibility branches', () => {
  it('returns an empty value without attempting decryption', () => {
    expect(decrypt('')).toBe('');
  });

  it('accepts legacy unencrypted provider keys', () => {
    expect(decrypt('sk-or-example-key')).toBe('sk-or-example-key');
  });

  it('does not classify malformed values as legacy encryption', () => {
    expect(isLegacyFormat('plain-text-value')).toBe(false);
    expect(isLegacyFormat('a:b:c:d')).toBe(false);
  });
});
