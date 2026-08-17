/**
 * Helpa Core Platform — Super Admin Authorization
 *
 * Server-side authorization verifying Super Admin privileges across platform APIs and views.
 * Primary platform owner: susantalohr@gmail.com
 */

import { redirect } from 'next/navigation';
import { getCurrentAccount } from '@/lib/auth/account';
import {
  createClient as createSupabaseServerClient,
  getAdminClient as getSupabaseAdminClient,
} from '@/lib/supabase/server';

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
    // 1. Direct Supabase Auth session check
    try {
      const supabase = await createSupabaseServerClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        if (isPlatformOwnerEmail(user.email)) return true;

        const admin = getSupabaseAdminClient();
        const { data: profile } = await admin
          .from('profiles')
          .select('is_super_admin, email')
          .eq('user_id', user.id)
          .maybeSingle();

        if (profile) {
          if (isPlatformOwnerEmail(profile.email)) return true;
          if (Boolean(profile.is_super_admin)) return true;
        }
      }
    } catch {
      // Continue to next check
    }

    // 2. Account context check
    const ctx = await getCurrentAccount();
    if (ctx?.email && isPlatformOwnerEmail(ctx.email)) {
      return true;
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
    const isSuper = await checkSuperAdmin();

    if (!isSuper) {
      redirect('/dashboard');
    }

    try {
      const ctx = await getCurrentAccount();
      return { id: ctx.userId, accountId: ctx.accountId, role: ctx.role };
    } catch {
      return {
        id: 'super_admin',
        accountId: 'default_account',
        role: 'owner' as const,
      };
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'digest' in error) {
      throw error;
    }
    redirect('/login');
  }
}
