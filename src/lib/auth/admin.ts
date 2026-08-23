/**
 * Helpa Core Platform — Super Admin Authorization
 *
 * Super Admin access is granted only by a persisted `profiles.is_super_admin`
 * role for the authenticated Supabase user. Email addresses are never
 * authorization evidence.
 */

import { redirect } from 'next/navigation';
import { getCurrentAccount } from '@/lib/auth/account';
import {
  createClient as createSupabaseServerClient,
  getAdminClient,
} from '@/lib/supabase/server';

/** @deprecated Email-based platform authorization is intentionally disabled. */
export function isPlatformOwnerEmail(_email?: string | null): boolean {
  return false;
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

/** Verifies the authenticated Supabase user's persisted platform role. */
export async function checkSuperAdmin(
  _untrustedEmailHint?: string
): Promise<boolean> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user?.id) return false;
    return await hasPersistedSuperAdminRole(user.id);
  } catch {
    return false;
  }
}

/** Enforces Super Admin access server-side. */
export async function requireSuperAdmin() {
  if (!(await checkSuperAdmin())) redirect('/dashboard');

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
