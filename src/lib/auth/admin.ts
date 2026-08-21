/**
 * Helpa Core Platform — Super Admin Authorization
 *
 * Super Admin access is granted only by a persisted `profiles.is_super_admin`
 * role for the authenticated user. Email addresses are never authorization.
 */

import { redirect } from 'next/navigation';
import { getCurrentAccount } from '@/lib/auth/account';
import {
  createClient as createSupabaseServerClient,
  getAdminClient,
} from '@/lib/supabase/server';

/** Informational bootstrap configuration; never use it to grant access. */
export const PLATFORM_OWNER_EMAIL =
  process.env.HELPA_PLATFORM_OWNER_EMAIL?.trim().toLowerCase() || '';

/** @deprecated Email matching is informational only, not authorization. */
export function isPlatformOwnerEmail(email?: string | null): boolean {
  if (!email || !PLATFORM_OWNER_EMAIL) return false;
  return email.trim().toLowerCase() === PLATFORM_OWNER_EMAIL;
}

async function hasPersistedSuperAdminRole(userId: string): Promise<boolean> {
  if (!userId) return false;

  const admin = getAdminClient();
  const { data: profile, error } = await admin
    .from('profiles')
    .select('is_super_admin')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('[checkSuperAdmin] profile lookup failed:', error);
    return false;
  }

  return profile?.is_super_admin === true;
}

/**
 * Verifies the current authenticated session has a persisted Super Admin role.
 * When supplied, `expectedEmail` only verifies the caller refers to the current
 * session; it can never grant access by itself.
 */
export async function checkSuperAdmin(expectedEmail?: string): Promise<boolean> {
  try {
    try {
      const supabase = await createSupabaseServerClient();
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (!error && user) {
        if (
          expectedEmail &&
          user.email?.trim().toLowerCase() !== expectedEmail.trim().toLowerCase()
        ) {
          return false;
        }

        return await hasPersistedSuperAdminRole(user.id);
      }
    } catch {
      // Rollback mode may not have a Supabase session; use verified account context.
    }

    const context = await getCurrentAccount();
    if (
      expectedEmail &&
      context.email?.trim().toLowerCase() !== expectedEmail.trim().toLowerCase()
    ) {
      return false;
    }
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
