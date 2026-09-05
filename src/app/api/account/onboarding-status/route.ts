/**
 * GET /api/account/onboarding-status
 *
 * Returns whether the authenticated account owner still needs to complete
 * the guided onboarding wizard.
 *
 * Eligibility is authoritative: a NULL `welcome_message` on the account row
 * means the onboarding flow has never been completed (the trigger never sets
 * it; only /api/account/onboard writes it). Non-owner roles receive 403 —
 * onboarding is an owner-only action.
 *
 * Response shape: { needs_onboarding: boolean }
 */

import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { getAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const ctx = await requireRole('owner');
    const supabase = getAdminClient();

    const { data, error } = await supabase
      .from('accounts')
      .select('welcome_message')
      .eq('id', ctx.accountId)
      .maybeSingle();

    if (error) {
      console.error('[onboarding-status] db error:', error);
      // Fail open — if we can't read, don't block the dashboard
      return NextResponse.json({ needs_onboarding: false });
    }

    // welcome_message is set by /api/account/onboard on completion.
    // NULL means the onboarding flow has never been completed.
    const needs_onboarding = data?.welcome_message == null;

    return NextResponse.json({ needs_onboarding });
  } catch (err: unknown) {
    return toErrorResponse(err);
  }
}
