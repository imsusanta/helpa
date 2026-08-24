import crypto from 'node:crypto';

export type CronAuthorizationResult =
  | { authorized: true }
  | { authorized: false; status: 401 | 503; message: string };

/**
 * Every scheduled endpoint authorizes through this helper, so cron
 * authentication has exactly one place to review and harden.
 *
 * Rules:
 * - Fails closed. When none of the candidate secrets are configured the
 *   request is rejected with 503 instead of being let through.
 * - Accepts the secret either in `x-cron-secret` or as
 *   `Authorization: Bearer <secret>`, so a single scheduler
 *   configuration can drive every endpoint.
 * - Compares in constant time so the secret cannot be recovered from
 *   response-time differences.
 * - Never relaxes the check based on NODE_ENV. Preview and staging
 *   deployments read real tenant data and are authorized identically.
 */
export function authorizeCronRequest(
  request: Request,
  envName: string | string[] = 'CRON_SECRET'
): CronAuthorizationResult {
  const envNames = Array.isArray(envName) ? envName : [envName];
  const expectedSecrets = envNames
    .map((name) => process.env[name])
    .filter((value): value is string => Boolean(value));

  if (expectedSecrets.length === 0) {
    return {
      authorized: false,
      status: 503,
      message: 'Cron secret not configured',
    };
  }

  const suppliedSecrets = readSuppliedSecrets(request);
  const authorized = suppliedSecrets.some((supplied) =>
    expectedSecrets.some((expected) => secretsMatch(expected, supplied))
  );

  if (!authorized) {
    return { authorized: false, status: 401, message: 'Unauthorized' };
  }

  return { authorized: true };
}

function readSuppliedSecrets(request: Request): string[] {
  const supplied: string[] = [];

  const headerSecret = request.headers.get('x-cron-secret');
  if (headerSecret) supplied.push(headerSecret);

  const authorization = request.headers.get('authorization') || '';
  if (authorization.toLowerCase().startsWith('bearer ')) {
    const bearerSecret = authorization.slice('bearer '.length).trim();
    if (bearerSecret) supplied.push(bearerSecret);
  }

  return supplied;
}

function secretsMatch(expected: string, supplied: string): boolean {
  const expectedBuffer = Buffer.from(expected, 'utf8');
  const suppliedBuffer = Buffer.from(supplied, 'utf8');

  // timingSafeEqual throws on a length mismatch, and the length itself is
  // not sensitive, so it is safe to short-circuit here.
  if (expectedBuffer.length !== suppliedBuffer.length) return false;

  return crypto.timingSafeEqual(expectedBuffer, suppliedBuffer);
}
