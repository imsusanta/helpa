/**
 * Helpa Core Platform — Super Admin Authorization
 *
 * Super Admin access is granted *only* by the persisted
 * `profiles.is_super_admin` flag for the authenticated user.
 *
 * Email addresses are never an authorization input. An email is a routable
 * identifier, not a credential: a user can change it, an unverified signup
 * can claim it, and — because this module used to compare it against a
 * hardcoded constant — "register that address" was equivalent to "become
 * platform owner". The address that previously acted as a fallback is now
 * seeded into `profiles.is_super_admin` exactly once, by migration
 * `20260822160000_deemail_super_admin_authorization.sql`, and every
 * request-time decision reads the database column instead.
 */

import { redirect } from 'next/navigation';
import { getCurrentAccount } from '@/lib/auth/account';
import {
  createClient as createSupabaseServerClient,
  getAdminClient,
} from '@/lib/supabase/server';

async function hasPersistedSuperAdminRole(userId: string): Promise<boolean> {
  if (!userId) return false;

  const admin = getAdminClient();
  const { data: profile, error } = await admin
    .from('profiles')
    .select('is_super_admin')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    // Fail closed — an unreadable role is not a granted role.
    console.error('[checkSuperAdmin] profile lookup failed:', error);
    return false;
  }

  return profile?.is_super_admin === true;
}

/**
 * Resolves whether the *currently authenticated* caller holds the platform
 * super-admin role.
 *
 * Deliberately takes no arguments. The previous signature accepted an
 * `expectedEmail` and, when passed, returned whether that string equalled
 * the platform-owner constant — short-circuiting before any session was
 * checked. Any caller holding a string could mint a `true` from it, so the
 * parameter is gone rather than merely discouraged.
 */
export async function checkSuperAdmin(): Promise<boolean> {
  try {
    try {
      const supabase = await createSupabaseServerClient();
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (!error && user) {
        return await hasPersistedSuperAdminRole(user.id);
      }
    } catch {
      // Rollback mode may not have a Supabase session; fall through to the
      // verified account context below.
    }

    const context = await getCurrentAccount();
    return await hasPersistedSuperAdminRole(context.userId);
  } catch {
    return false;
  }
}

/** Enforces Super Admin access server-side. */
export async function requireSuperAdmin() {
  const isSuperAdmin = await checkSuperAdmin();
  if (!isSuperAdmin) redirect('/dashboard');

  try {
    const context = await getCurrentAccount();
    return {
      id: context.userId,
      accountId: context.accountId,
      role: context.role,
    };
  } catch {
    redirect('/login');
  }
}
