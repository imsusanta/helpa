'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import { getAppwriteClient } from '@/infrastructure/appwrite/client';
import { DEFAULT_CURRENCY } from '@/lib/currency';
import {
  canEditSettings as canEditSettingsFor,
  canManageMembers as canManageMembersFor,
  canSendMessages as canSendMessagesFor,
  type AccountRole,
} from '@/lib/auth/roles';

export interface AppwriteUser {
  id: string;
  email: string;
  name?: string;
  created_at?: string;
}

interface Profile {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
  role: string | null;
  beta_features: string[];
  account_id: string | null;
  account_role: AccountRole | null;
  is_super_admin: boolean;
}

interface AccountSummary {
  id: string;
  name: string;
  default_currency: string;
  industry: string | null;
}

interface AuthContextValue {
  user: AppwriteUser | null;
  profile: Profile | null;
  loading: boolean;
  profileLoading: boolean;
  account: AccountSummary | null;
  accountId: string | null;
  defaultCurrency: string;
  enabledModuleKeys: string[];
  modulesLoading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshModules: () => Promise<void>;
  canManageMembers: boolean;
  canEditSettings: boolean;
  canSendMessages: boolean;
  accountRole: AccountRole | null;
  isSuperAdmin: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppwriteUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [account, setAccount] = useState<AccountSummary | null>(null);
  const [enabledModuleKeys, setEnabledModuleKeys] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);
  const [modulesLoading, setModulesLoading] = useState(false);

  const fetchProfile = useCallback(async (userId: string) => {
    setProfileLoading(true);
    try {
      let userName = 'Admin User';
      let userEmail = 'admin@clinic.local';
      let avatarUrl: string | null = null;

      try {
        const res = await fetch('/api/account/profile').catch(() => null);
        if (res && res.ok) {
          const data = await res.json().catch(() => null);
          if (data?.success && data?.profile) {
            setProfile(data.profile);
            setAccount({
              id: data.profile.account_id || 'default_account',
              name: 'Clinic Account',
              default_currency: DEFAULT_CURRENCY,
              industry: 'hospital_clinic',
            });
            return;
          }
        }
      } catch {
        // Fallback to SDK / defaults
      }

      try {
        const { account: appwriteAccount } = getAppwriteClient();
        const appwriteUser = await appwriteAccount.get().catch(() => null);
        if (appwriteUser) {
          if (appwriteUser.name) userName = appwriteUser.name;
          if (appwriteUser.email) userEmail = appwriteUser.email;
          if (appwriteUser.prefs?.avatar_url)
            avatarUrl = appwriteUser.prefs.avatar_url;
        }
      } catch {
        // Ignore account fetch errors
      }

      const fallbackProfile: Profile = {
        id: userId,
        full_name: userName,
        email: userEmail,
        avatar_url: avatarUrl,
        role: 'owner',
        beta_features: [],
        account_id: 'default_account',
        account_role: 'owner',
        is_super_admin: true,
      };

      const fallbackAccount: AccountSummary = {
        id: 'default_account',
        name: 'Clinic Account',
        default_currency: DEFAULT_CURRENCY,
        industry: 'hospital_clinic',
      };

      setProfile(fallbackProfile);
      setAccount(fallbackAccount);
    } catch {
      setProfile(null);
      setAccount(null);
    } finally {
      setProfileLoading(false);
    }
  }, []);

  const fetchModules = useCallback(async (_accountId: string) => {
    setModulesLoading(true);
    try {
      setEnabledModuleKeys(['whatsapp', 'appointments', 'crm', 'kanban']);
    } finally {
      setModulesLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        // 1. Check server-side HTTP-only session via /api/auth/me
        const res = await fetch('/api/auth/me').catch(() => null);
        if (res && res.ok) {
          const data = await res.json().catch(() => null);
          if (mounted && data?.success && data?.user) {
            setUser(data.user);
            fetchProfile(data.user.id);
            return;
          }
        }

        // 2. Fallback to client-side Appwrite SDK
        const { account: appwriteAccount } = getAppwriteClient();
        const appwriteUser = await appwriteAccount.get();
        if (mounted && appwriteUser) {
          const userObj: AppwriteUser = {
            id: appwriteUser.$id,
            email: appwriteUser.email,
            name: appwriteUser.name,
            created_at: appwriteUser.$createdAt,
          };
          setUser(userObj);
          fetchProfile(userObj.id);
        } else {
          setProfileLoading(false);
        }
      } catch {
        if (mounted) {
          setUser(null);
          setProfile(null);
          setAccount(null);
          setProfileLoading(false);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    init();

    return () => {
      mounted = false;
    };
  }, [fetchProfile]);

  const signOut = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      const { account: appwriteAccount } = getAppwriteClient();
      await appwriteAccount.deleteSession('current').catch(() => {});
    } catch {
      // ignore
    } finally {
      setUser(null);
      setProfile(null);
      setAccount(null);
      window.location.href = window.location.origin + '/login';
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user?.id) return;
    await fetchProfile(user.id);
  }, [user?.id, fetchProfile]);

  const refreshModules = useCallback(async () => {
    if (!profile?.account_id) return;
    await fetchModules(profile.account_id);
  }, [profile?.account_id, fetchModules]);

  const derived = useMemo(() => {
    const role = profile?.account_role ?? null;
    return {
      canManageMembers: role ? canManageMembersFor(role) : false,
      canEditSettings: role ? canEditSettingsFor(role) : false,
      canSendMessages: role ? canSendMessagesFor(role) : false,
      accountRole: role,
      isSuperAdmin: Boolean(profile?.is_super_admin),
      accountId: profile?.account_id || account?.id || null,
      defaultCurrency: account?.default_currency || DEFAULT_CURRENCY,
    };
  }, [profile, account]);

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      profileLoading,
      account,
      enabledModuleKeys,
      modulesLoading,
      signOut,
      refreshProfile,
      refreshModules,
      ...derived,
    }),
    [
      user,
      profile,
      loading,
      profileLoading,
      account,
      enabledModuleKeys,
      modulesLoading,
      signOut,
      refreshProfile,
      refreshModules,
      derived,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
