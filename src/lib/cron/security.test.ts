import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { authorizeCronRequest } from './security';

const ORIGINAL_SECRET = process.env.CRON_SECRET;
const ORIGINAL_AUTOMATION_SECRET = process.env.AUTOMATION_CRON_SECRET;

const cronRequest = (headers: Record<string, string> = {}) =>
  new Request('https://helpa.test/api/cron/reminders', { headers });

beforeEach(() => {
  delete process.env.CRON_SECRET;
  delete process.env.AUTOMATION_CRON_SECRET;
});

afterEach(() => {
  if (ORIGINAL_SECRET === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = ORIGINAL_SECRET;

  if (ORIGINAL_AUTOMATION_SECRET === undefined)
    delete process.env.AUTOMATION_CRON_SECRET;
  else process.env.AUTOMATION_CRON_SECRET = ORIGINAL_AUTOMATION_SECRET;
});

describe('authorizeCronRequest', () => {
  it('fails closed when CRON_SECRET is not configured', () => {
    const result = authorizeCronRequest(cronRequest());
    expect(result).toEqual({
      authorized: false,
      status: 503,
      message: 'Cron secret not configured',
    });
  });

  it('fails closed when none of the candidate secrets are configured', () => {
    const result = authorizeCronRequest(
      cronRequest({ 'x-cron-secret': 'anything' }),
      ['AUTOMATION_CRON_SECRET', 'CRON_SECRET']
    );
    expect(result).toEqual({
      authorized: false,
      status: 503,
      message: 'Cron secret not configured',
    });
  });

  it('rejects missing and incorrect header values', () => {
    process.env.CRON_SECRET = 'a-long-production-secret';
    expect(authorizeCronRequest(cronRequest())).toMatchObject({
      authorized: false,
      status: 401,
    });
    expect(
      authorizeCronRequest(cronRequest({ 'x-cron-secret': 'wrong-secret' }))
    ).toMatchObject({ authorized: false, status: 401 });
  });

  it('rejects a prefix of the configured secret', () => {
    process.env.CRON_SECRET = 'a-long-production-secret';
    expect(
      authorizeCronRequest(cronRequest({ 'x-cron-secret': 'a-long' }))
    ).toMatchObject({ authorized: false, status: 401 });
  });

  it('accepts the matching header value', () => {
    process.env.CRON_SECRET = 'a-long-production-secret';
    const result = authorizeCronRequest(
      cronRequest({ 'x-cron-secret': 'a-long-production-secret' })
    );
    expect(result).toEqual({ authorized: true });
  });

  it('accepts the secret from an Authorization bearer header', () => {
    process.env.CRON_SECRET = 'a-long-production-secret';
    const result = authorizeCronRequest(
      cronRequest({ authorization: 'Bearer a-long-production-secret' })
    );
    expect(result).toEqual({ authorized: true });
  });

  it('accepts any of the candidate env names', () => {
    process.env.AUTOMATION_CRON_SECRET = 'automation-only-secret';
    const result = authorizeCronRequest(
      cronRequest({ 'x-cron-secret': 'automation-only-secret' }),
      ['AUTOMATION_CRON_SECRET', 'CRON_SECRET']
    );
    expect(result).toEqual({ authorized: true });
  });
});
