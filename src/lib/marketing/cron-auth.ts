import { NextResponse } from 'next/server';
import { authorizeCronRequest as authorizeCron } from '@/lib/cron/security';

/**
 * Campaign cron guard. Delegates to the shared fail-closed cron authorizer
 * so marketing jobs never run without a configured secret, including in
 * preview and local environments.
 *
 * Returns the 401/503 response to send, or null when the caller is allowed.
 */
export function authorizeCronRequest(request: Request): NextResponse | null {
  const result = authorizeCron(request);
  if (result.authorized) return null;
  return NextResponse.json(
    { error: result.message },
    { status: result.status }
  );
}
