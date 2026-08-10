import { afterEach, describe, expect, it } from 'vitest';
import { authorizeCronRequest } from './security';

const ORIGINAL_SECRET = process.env.CRON_SECRET;

afterEach(() => {
  if (ORIGINAL_SECRET === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = ORIGINAL_SECRET;
});

describe('authorizeCronRequest', () => {
  it('fails closed when CRON_SECRET is not configured', () => {
    delete process.env.CRON_SECRET;
    const result = authorizeCronRequest(
      new Request('https://helpa.test/api/cron/reminders')
    );
    expect(result).toEqual({
      authorized: false,
      status: 503,
      message: 'Cron secret not configured',
    });
  });

  it('rejects missing and incorrect header values', () => {
    process.env.CRON_SECRET = 'a-long-production-secret';
    expect(
      authorizeCronRequest(new Request('https://helpa.test/api/cron/reminders'))
    ).toMatchObject({ authorized: false, status: 401 });
    expect(
      authorizeCronRequest(
        new Request('https://helpa.test/api/cron/reminders', {
          headers: { 'x-cron-secret': 'wrong-secret' },
        })
      )
    ).toMatchObject({ authorized: false, status: 401 });
  });

  it('accepts the matching header value', () => {
    process.env.CRON_SECRET = 'a-long-production-secret';
    const result = authorizeCronRequest(
      new Request('https://helpa.test/api/cron/reminders', {
        headers: { 'x-cron-secret': 'a-long-production-secret' },
      })
    );
    expect(result).toEqual({ authorized: true });
  });
});
