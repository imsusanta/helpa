import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/account';
import { generateOAuthState } from '@/lib/whatsapp/oauth-state';
import {
  checkRateLimit,
  rateLimitResponse,
  RATE_LIMITS,
} from '@/lib/rate-limit';

export async function POST() {
  try {
    const ctx = await requireRole('admin');

    const rateLimit = checkRateLimit(
      `oauth_session_${ctx.userId}`,
      RATE_LIMITS.adminAction
    );
    if (!rateLimit.success) {
      return rateLimitResponse(rateLimit);
    }

    const { state, expiresAt } = await generateOAuthState({
      accountId: ctx.accountId,
      userId: ctx.userId,
    });

    const appId =
      process.env.META_APP_ID || process.env.NEXT_PUBLIC_META_APP_ID || '';
    const configId =
      process.env.META_CONFIG_ID ||
      process.env.NEXT_PUBLIC_META_CONFIG_ID ||
      '';

    return NextResponse.json({
      success: true,
      state,
      expiresAt,
      appId,
      configId,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Internal server error';
    const status = (err as { status?: number })?.status || 500;
    return NextResponse.json({ error: message }, { status });
  }
}
