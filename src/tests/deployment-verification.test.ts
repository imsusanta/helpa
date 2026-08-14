import { describe, it, expect } from 'vitest';

describe('Post-Deployment SHA Verification Logic', () => {
  const SHA_40_REGEX = /^[0-9a-f]{40}$/i;

  it('validates matching 40-character SHA', () => {
    const expectedSha = 'ea1bbc19500565470fbf78250e899ee9357e8701';
    const deployedSha = 'ea1bbc19500565470fbf78250e899ee9357e8701';

    expect(SHA_40_REGEX.test(deployedSha)).toBe(true);
    expect(deployedSha.toLowerCase()).toBe(expectedSha.toLowerCase());
  });

  it('fails on mismatched SHA', () => {
    const expectedSha = 'ea1bbc19500565470fbf78250e899ee9357e8701';
    const deployedSha = '1111111111111111111111111111111111111111';

    expect(deployedSha.toLowerCase() === expectedSha.toLowerCase()).toBe(false);
  });

  it('fails on "unknown", empty, or truncated SHA', () => {
    expect(SHA_40_REGEX.test('unknown')).toBe(false);
    expect(SHA_40_REGEX.test('')).toBe(false);
    expect(SHA_40_REGEX.test('ea1bbc1')).toBe(false);
    expect(SHA_40_REGEX.test('null')).toBe(false);
  });
});
