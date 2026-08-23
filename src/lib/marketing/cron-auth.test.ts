import { afterEach, describe, expect, it, vi } from 'vitest';
import { authorizeCronRequest } from './cron-auth';

const ORIGINAL_SECRET = process.env.CRON_SECRET;

afterEach(() => {
  if (ORIGINAL_SECRET === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = ORIGINAL_SECRET;
  vi.unstubAllEnvs();
});

function get(url = 'https://helpa.test/api/cron/campaigns') {
  return authorizeCronRequest(new Request(url));
}

describe('authorizeCronRequest', () => {
  it('allows requests in non-production when no secret is configured', () => {
    delete process.env.CRON_SECRET;
    vi.stubEnv('NODE_ENV', 'test');
    expect(get()).toBeNull();
  });

  it('fails closed in production when CRON_SECRET is unset', () => {
    delete process.env.CRON_SECRET;
    vi.stubEnv('NODE_ENV', 'production');
    const res = get();
    expect(res?.status).toBe(401);
  });

  it('rejects missing or wrong bearer tokens', async () => {
    process.env.CRON_SECRET = 'expected-secret';
    expect(get()?.status).toBe(401);
    expect(
      authorizeCronRequest(
        new Request('https://helpa.test/api/cron/campaigns', {
          headers: { authorization: 'Bearer wrong-secret' },
        })
      )?.status
    ).toBe(401);
  });

  it('accepts the correct bearer token', () => {
    process.env.CRON_SECRET = 'expected-secret';
    expect(
      authorizeCronRequest(
        new Request('https://helpa.test/api/cron/campaigns', {
          headers: { authorization: 'Bearer expected-secret' },
        })
      )
    ).toBeNull();
  });

  it('ignores secrets smuggled through the query string', () => {
    process.env.CRON_SECRET = 'expected-secret';
    expect(get('https://helpa.test/api/cron/campaigns?secret=expected-secret')?.status).toBe(401);
  });
});
