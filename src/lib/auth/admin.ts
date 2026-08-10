import { redirect } from 'next/navigation';
import { getAppwriteAdminClient } from '@/infrastructure/appwrite/server';
import { profilesRepository } from '@/infrastructure/appwrite/repositories/profiles.repository';

export async function requireSuperAdmin() {
  try {
    const { account } = getAppwriteAdminClient();
    const appwriteUser = await account.get().catch(() => null);

    if (!appwriteUser) {
      redirect('/login');
    }

    const profile = await profilesRepository.getProfileByUserId(
      appwriteUser.$id
    );
    if (!profile || !profile.is_super_admin) {
      redirect('/dashboard');
    }

    return appwriteUser;
  } catch {
    redirect('/login');
  }
}

export async function checkSuperAdmin(): Promise<boolean> {
  try {
    const { account } = getAppwriteAdminClient();
    const appwriteUser = await account.get().catch(() => null);
    if (!appwriteUser) return false;

    const profile = await profilesRepository.getProfileByUserId(
      appwriteUser.$id
    );
    return Boolean(profile?.is_super_admin);
  } catch {
    return false;
  }
}
