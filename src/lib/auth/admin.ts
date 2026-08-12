import { redirect } from 'next/navigation';
import { getCurrentAccount } from '@/lib/auth/account';
import {
  profilesRepository,
  type ProfileDocument,
} from '@/infrastructure/appwrite/repositories/profiles.repository';

export async function requireSuperAdmin() {
  try {
    const ctx = await getCurrentAccount();
    let profile: ProfileDocument | null = null;
    try {
      profile = await profilesRepository.getProfileByUserId(ctx.userId);
    } catch (e) {
      console.warn('[requireSuperAdmin] profile fetch error:', e);
    }

    const isSuperAdmin =
      Boolean(profile?.is_super_admin) || ctx.role === 'owner';
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
    let profile: ProfileDocument | null = null;
    try {
      profile = await profilesRepository.getProfileByUserId(ctx.userId);
    } catch (e) {
      console.warn('[checkSuperAdmin] profile fetch error:', e);
    }
    return Boolean(profile?.is_super_admin) || ctx.role === 'owner';
  } catch {
    return false;
  }
}
