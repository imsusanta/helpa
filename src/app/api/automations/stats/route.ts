import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { checkPlanLimits } from '@/lib/saas/subscription';

/**
 * Read-only automation metrics for the Automation & AI module.
 *
 * SECURITY: viewer+ can read. Both figures are REAL COUNT(*) queries scoped to
 * the authenticated account (total automations, and active ones). The plan
 * limit comes from the SaaS plan-limits helper. No fabricated values.
 * `ctx.admin` is the service-role client, so every query is explicitly
 * constrained to `account_id = ctx.accountId`.
 */
export async function GET() {
  try {
    const ctx = await requireRole('viewer');
    const db = ctx.admin;
    const accountId = ctx.accountId;

    if (!db) {
      throw new Error('Account data client is unavailable.');
    }

    const [totalRes, activeRes] = await Promise.all([
      db
        .from('automations')
        .select('id', { count: 'exact', head: true })
        .eq('account_id', accountId),
      db
        .from('automations')
        .select('id', { count: 'exact', head: true })
        .eq('account_id', accountId)
        .eq('is_active', true),
    ]);

    const total = totalRes.count ?? 0;
    const active = activeRes.count ?? 0;

    // Plan limit for automations (best-effort; falls back gracefully).
    let limit = 0;
    let remaining = 0;
    try {
      const usage = await checkPlanLimits(accountId, 'automations');
      limit = usage.limit;
      remaining = usage.remaining;
    } catch (err) {
      console.warn('[GET /api/automations/stats] limit lookup failed:', err);
    }

    return NextResponse.json({
      total,
      active,
      inactive: Math.max(0, total - active),
      limit,
      remaining,
    });
  } catch (err) {
    console.error('[GET /api/automations/stats] error:', err);
    return toErrorResponse(err);
  }
}
