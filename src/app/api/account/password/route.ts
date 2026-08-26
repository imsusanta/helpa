import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getCurrentAccount, toErrorResponse } from '@/lib/auth/account';
import { getAdminClient as getSupabaseAdminClient } from '@/lib/supabase/server';
import { requireSupabasePublicConfig } from '@/lib/runtime-config';
import {
  checkRateLimit,
  rateLimitResponse,
  RATE_LIMITS,
} from '@/lib/rate-limit';

export async function POST(request: Request) {
  try {
    const ctx = await getCurrentAccount();
    if (!ctx.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as {
      currentPassword?: string;
      newPassword?: string;
    } | null;

    const newPassword = body?.newPassword;
    if (
      !newPassword ||
      typeof newPassword !== 'string' ||
      newPassword.length < 8
    ) {
      return NextResponse.json(
        { error: 'New password must be at least 8 characters long' },
        { status: 400 }
      );
    }

    // Re-authenticate before rotating the credential. Without this, a
    // stolen session cookie is enough to silently take over the account
    // by setting a new password.
    const currentPassword = body?.currentPassword;
    if (!currentPassword || typeof currentPassword !== 'string') {
      return NextResponse.json(
        { error: 'Current password is required' },
        { status: 400 }
      );
    }

    const limit = await checkRateLimit(
      `password_change_${ctx.userId}`,
      RATE_LIMITS.auth
    );
    if (!limit.success) return rateLimitResponse(limit);

    if (!ctx.email) {
      return NextResponse.json(
        { error: 'Unable to verify current password for this account' },
        { status: 400 }
      );
    }

    // Verify against a throwaway anon client so the service-role client
    // never carries a user session.
    const { url, publishableKey } = requireSupabasePublicConfig();
    const reauthClient = createSupabaseClient(url, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: reauthErr } = await reauthClient.auth.signInWithPassword({
      email: ctx.email,
      password: currentPassword,
    });
    if (reauthErr) {
      return NextResponse.json(
        { error: 'Current password is incorrect' },
        { status: 403 }
      );
    }

    const supabase = getSupabaseAdminClient();
    const { error: updateErr } = await supabase.auth.admin.updateUserById(
      ctx.userId,
      {
        password: newPassword,
      }
    );

    if (updateErr) {
      return NextResponse.json(
        { error: updateErr.message || 'Failed to update password' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Password updated successfully!',
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
