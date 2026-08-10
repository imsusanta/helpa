import crypto from 'node:crypto';

export type CronAuthorizationResult =
  | { authorized: true }
  | { authorized: false; status: 401 | 503; message: string };

/**
 * Authorizes an internal cron request using a header-only shared secret.
 * Fails closed when the configured secret is absent.
 */
export function authorizeCronRequest(
  request: Request,
  envName = 'CRON_SECRET'
): CronAuthorizationResult {
  const expected = process.env[envName];
  if (!expected) {
    return {
      authorized: false,
      status: 503,
      message: 'Cron secret not configured',
    };
  }

  const supplied = request.headers.get('x-cron-secret') || '';
  const expectedBuffer = Buffer.from(expected, 'utf8');
  const suppliedBuffer = Buffer.from(supplied, 'utf8');

  if (
    expectedBuffer.length !== suppliedBuffer.length ||
    !crypto.timingSafeEqual(expectedBuffer, suppliedBuffer)
  ) {
    return { authorized: false, status: 401, message: 'Unauthorized' };
  }

  return { authorized: true };
}
