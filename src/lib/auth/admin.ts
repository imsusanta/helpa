import { redirect } from 'next/navigation';
import { getCurrentAccount } from '@/lib/auth/account';
import { getAdminClient as getSupabaseAdminClient } from '@/lib/supabase/server';

export async function requireSuperAdmin() {
  try {
    const ctx = await getCurrentAccount();
    const admin = getSupabaseAdminClient();
    const { data: profile } = await admin
      .from('profiles')
      .select('is_super_admin')
      .eq('user_id', ctx.userId)
      .maybeSingle();

    const isSuperAdmin = Boolean(profile?.is_super_admin);
    if (!isSuperAdmin) {
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

export async function checkSuperAdmin(): Promise<boolean> {
  try {
    const ctx = await getCurrentAccount();
    const admin = getSupabaseAdminClient();
    const { data: profile } = await admin
      .from('profiles')
      .select('is_super_admin')
      .eq('user_id', ctx.userId)
      .maybeSingle();

    return Boolean(profile?.is_super_admin);
  } catch {
    return false;
  }
}
