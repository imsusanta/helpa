/**
 * Helpa Core Platform — Super Admin Authorization
 *
 * Server-side authorization verifying Super Admin privileges across platform APIs and views.
 * Primary platform owner: susantalohr@gmail.com
 */

import { redirect } from 'next/navigation';
import { getCurrentAccount } from '@/lib/auth/account';
import { getAdminClient as getSupabaseAdminClient } from '@/lib/supabase/server';

export const PLATFORM_OWNER_EMAIL = 'susantalohr@gmail.com';

/**
 * Checks if an email is the primary platform owner email.
 */
export function isPlatformOwnerEmail(email?: string | null): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === PLATFORM_OWNER_EMAIL.toLowerCase();
}

/**
 * Verifies if the current session or specified user has Super Admin platform privileges.
 */
export async function checkSuperAdmin(userEmail?: string): Promise<boolean> {
  if (userEmail && isPlatformOwnerEmail(userEmail)) {
    return true;
  }

  try {
    const ctx = await getCurrentAccount();
    if (ctx?.email && isPlatformOwnerEmail(ctx.email)) {
      return true;
    }

    const admin = getSupabaseAdminClient();
    const { data: profile } = await admin
      .from('profiles')
      .select('is_super_admin, email')
      .eq('user_id', ctx.userId)
      .maybeSingle();

    if (profile) {
      if (isPlatformOwnerEmail(profile.email)) return true;
      return Boolean(profile.is_super_admin);
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Enforces Super Admin access server-side. Redirects to /dashboard if unauthorized.
 */
export async function requireSuperAdmin() {
  try {
    const ctx = await getCurrentAccount();
    const isSuper = await checkSuperAdmin();

    if (!isSuper) {
      redirect('/dashboard');
    }

    return { id: ctx.userId, accountId: ctx.accountId, role: ctx.role };
  } catch (error) {
    if (error && typeof error === 'object' && 'digest' in error) {
      throw error;
    }
    redirect('/login');
  }
}
