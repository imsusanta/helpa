import { describe, it, expect } from 'vitest';

describe('Post-Deployment SHA Verification Logic', () => {
  const SHA_40_REGEX = /^[0-9a-f]{40}$/i;

  it('validates matching 40-character SHA', () => {
    const expectedSha = 'a7fdfd7633dadda4899a9b827abae813782b5172';
    const deployedSha = 'a7fdfd7633dadda4899a9b827abae813782b5172';

    expect(SHA_40_REGEX.test(deployedSha)).toBe(true);
    expect(deployedSha.toLowerCase()).toBe(expectedSha.toLowerCase());
  });

  it('fails on mismatched SHA', () => {
    const expectedSha = 'a7fdfd7633dadda4899a9b827abae813782b5172';
    const deployedSha = '1111111111111111111111111111111111111111';

    expect(deployedSha.toLowerCase() === expectedSha.toLowerCase()).toBe(false);
  });

  it('fails on "unknown", empty, or truncated SHA', () => {
    expect(SHA_40_REGEX.test('unknown')).toBe(false);
    expect(SHA_40_REGEX.test('')).toBe(false);
    expect(SHA_40_REGEX.test('a7fdfd7')).toBe(false);
    expect(SHA_40_REGEX.test('null')).toBe(false);
  });

  it('simulates polling retry when stale SHA is eventually replaced by expected SHA', async () => {
    const expectedSha = 'a7fdfd7633dadda4899a9b827abae813782b5172';
    const staleSha = '0000000000000000000000000000000000000000';

    let attempts = 0;
    const fetchSha = async () => {
      attempts++;
      if (attempts < 3) return staleSha;
      return expectedSha;
    };

    let matched = false;
    for (let i = 1; i <= 5; i++) {
      const sha = await fetchSha();
      if (sha === expectedSha) {
        matched = true;
        break;
      }
    }

    expect(matched).toBe(true);
    expect(attempts).toBe(3);
  });

  it('simulates bounded polling timeout when expected SHA never arrives', async () => {
    const expectedSha = 'a7fdfd7633dadda4899a9b827abae813782b5172';
    const staleSha = '0000000000000000000000000000000000000000';

    let attempts = 0;
    const maxAttempts = 3;
    const fetchSha = async () => {
      attempts++;
      return staleSha;
    };

    let matched = false;
    for (let i = 1; i <= maxAttempts; i++) {
      const sha = await fetchSha();
      if (sha === expectedSha) {
        matched = true;
        break;
      }
    }

    expect(matched).toBe(false);
    expect(attempts).toBe(maxAttempts);
  });
});
