import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

/**
 * Server Component / Server Action guard that checks if the current user
 * is a Super Admin. If not authenticated, redirects to /login. If authenticated
 * but not a super admin, redirects to /dashboard.
 */
export async function requireSuperAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_super_admin')
    .eq('user_id', user.id)
    .single();

  if (!profile || !profile.is_super_admin) {
    redirect('/dashboard');
  }

  return user;
}

/**
 * Checks if the current user is a Super Admin. Returns boolean.
 * Suitable for API routes.
 */
export async function checkSuperAdmin(): Promise<boolean> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return false;

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_super_admin')
      .eq('user_id', user.id)
      .single();

    return !!profile?.is_super_admin;
  } catch (err) {
    console.error('[checkSuperAdmin] error:', err);
    return false;
  }
}
