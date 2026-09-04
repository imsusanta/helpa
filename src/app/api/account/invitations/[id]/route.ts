// ============================================================
// DELETE /api/account/invitations/[id]
//
// Admin+. Revokes a pending invitation by id. RLS on
// `account_invitations` already restricts the DELETE to admins
// of the inviting account; we lean on it and skip the explicit
// ownership check.
//
// We intentionally delete the row outright rather than soft-
// deleting (a "revoked_at" flag). Once revoked, an invite is
// dead forever — there's no UX where a former invite should be
// listed; the plaintext token is gone too. Hard delete keeps
// the table small.
// ============================================================

import { NextResponse } from 'next/server';

import { requireRole, toErrorResponse } from '@/lib/auth/account';
import {
  checkRateLimit,
  rateLimitResponse,
  RATE_LIMITS,
} from '@/lib/rate-limit';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireRole('admin');

    const limit = await checkRateLimit(
      `admin:inviteRevoke:${ctx.userId}`,
      RATE_LIMITS.adminAction
    );
    if (!limit.success) return rateLimitResponse(limit);

    const { id } = await params;

    // `ctx.admin` is the service-role client, which bypasses RLS —
    // so the tenant filter must be applied explicitly here. Without it
    // an admin of any account could revoke another tenant's invitation
    // by guessing its id. A cross-account attempt now surfaces as a
    // silent 0-row delete (which is exactly what we want for a
    // revocation endpoint).
    const { error, count } = await ctx.admin
      .from('account_invitations')
      .delete({ count: 'exact' })
      .eq('id', id)
      .eq('account_id', ctx.accountId);

    if (error) {
      console.error('[DELETE /api/account/invitations/[id]] error:', error);
      return NextResponse.json(
        { error: 'Failed to revoke invitation' },
        { status: 500 }
      );
    }

    if (count === 0) {
      // Either the id doesn't exist or RLS hid it (different
      // account). 404 either way — surfacing "exists but not
      // yours" would leak existence.
      return NextResponse.json(
        { error: 'Invitation not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
