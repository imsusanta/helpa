import { NextResponse } from 'next/server';

/**
 * Shared Vercel Cron guard. In production — or whenever CRON_SECRET is
 * configured — the request must carry `Authorization: Bearer $CRON_SECRET`.
 * Returns the 401 response to send, or null when the caller is allowed
 * through (local dev without a secret configured).
 */
export function authorizeCronRequest(request: Request): NextResponse | null {
  const authHeader = request.headers.get('authorization');
  const expectedSecret = process.env.CRON_SECRET;

  if (process.env.NODE_ENV === 'production' || expectedSecret) {
    if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }
  return null;
}
