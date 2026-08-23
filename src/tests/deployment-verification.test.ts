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

describe('Vercel Configuration & Hobby Plan Constraints', () => {
  it('enforces that vercel.json cron expressions comply with Vercel Hobby limits', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const vercelConfigPath = path.join(process.cwd(), 'vercel.json');

    expect(fs.existsSync(vercelConfigPath)).toBe(true);
    const configContent = fs.readFileSync(vercelConfigPath, 'utf-8');
    const config = JSON.parse(configContent);

    if (config.crons) {
      expect(Array.isArray(config.crons)).toBe(true);
      // Hobby tier allows at most 2 cron jobs
      expect(config.crons.length).toBeLessThanOrEqual(2);

      for (const cron of config.crons) {
        expect(cron.path).toBeDefined();
        expect(typeof cron.path).toBe('string');
        expect(cron.path.startsWith('/')).toBe(true);

        expect(cron.schedule).toBeDefined();
        expect(typeof cron.schedule).toBe('string');

        // Must be a daily cron (e.g., '0 0 * * *' or '0 1 * * *') to prevent Vercel Hobby deployment rejection
        const isDailyCron = /^\d{1,2}\s+\d{1,2}\s+\*\s+\*\s+\*$/.test(
          cron.schedule.trim()
        );
        expect(
          isDailyCron,
          `Cron expression "${cron.schedule}" for path "${cron.path}" is not a daily cron. Vercel Hobby accounts reject minute or hourly crons, causing PR deployment failures.`
        ).toBe(true);
      }
    }
  });
});
