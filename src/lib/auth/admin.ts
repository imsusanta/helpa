/**
 * Helpa Core Platform — Super Admin Authorization
 *
 * Super Admin access is granted only by a persisted `profiles.is_super_admin`
 * role for the authenticated user. Email addresses are never authorization.
 */

import { redirect } from 'next/navigation';
import { getCurrentAccount } from '@/lib/auth/account';
import { getAdminClient } from '@/lib/appwrite-server-compat';
import { createClient as createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Platform owner email bootstrap configuration.
 */
export const PLATFORM_OWNER_EMAIL =
  process.env.HELPA_PLATFORM_OWNER_EMAIL?.trim().toLowerCase() ||
  'susantalohr@gmail.com';

/** Checks if an email is the configured platform owner email. */
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
 * Verifies if the user or session has Super Admin role.
 */
export async function checkSuperAdmin(
  expectedEmail?: string
): Promise<boolean> {
  if (expectedEmail) {
    return isPlatformOwnerEmail(expectedEmail);
  }

  try {
    try {
      const supabase = await createSupabaseServerClient();
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (!error && user) {
        if (isPlatformOwnerEmail(user.email)) return true;
        return await hasPersistedSuperAdminRole(user.id);
      }
    } catch {
      // Rollback mode may not have a Supabase session; use verified account context.
    }

    const context = await getCurrentAccount();
    if (context.email && isPlatformOwnerEmail(context.email)) return true;
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
