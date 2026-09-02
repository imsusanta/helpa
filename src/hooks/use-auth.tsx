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
import { useRouter } from 'next/navigation';
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
  accountId: string;
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
  const router = useRouter();
  const [user, setUser] = useState<AppwriteUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [account, setAccount] = useState<AccountSummary | null>(null);
  const [enabledModuleKeys, setEnabledModuleKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);
  const [modulesLoading, setModulesLoading] = useState(false);

  const fetchModules = useCallback(async (_accountId: string) => {
    setModulesLoading(true);
    try {
      const response = await fetch('/api/account/modules', {
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to load workspace modules');
      }
      const enabled = Array.isArray(payload?.modules)
        ? payload.modules
            .filter(
              (module: { enabled?: boolean; module_key?: unknown }) =>
                module?.enabled === true &&
                typeof module.module_key === 'string'
            )
            .map((module: { module_key: string }) => module.module_key)
        : [];
      setEnabledModuleKeys(enabled);
    } catch {
      // Fail closed when module configuration is unavailable.
      setEnabledModuleKeys([]);
    } finally {
      setModulesLoading(false);
    }
  }, []);

  const fetchProfile = useCallback(async (_userId: string) => {
    setProfileLoading(true);
    try {
      const response = await fetch('/api/account/profile', {
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success || !payload?.profile) {
        throw new Error(payload?.error || 'Failed to load profile');
      }
      if (Array.isArray(payload.enabled_modules)) {
        setEnabledModuleKeys(payload.enabled_modules);
      }
      setProfile(payload.profile);
      setAccount(
        payload.account || {
          id: payload.profile.account_id || '',
          name: 'Clinic Account',
          default_currency: DEFAULT_CURRENCY,
          industry: 'hospital_clinic',
        }
      );
    } catch {
      setProfile(null);
      setAccount(null);
      setEnabledModuleKeys([]);
    } finally {
      setProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        // The profile endpoint already verifies the Supabase session and returns
        // the user, profile, account, and enabled modules in one single response.
        // Avoiding separate /api/auth/me and /api/account/modules requests removes
        // two full network round trips from every cold dashboard load.
        const response = await fetch('/api/account/profile', {
          cache: 'no-store',
        });
        const payload = await response.json().catch(() => null);
        if (
          !response.ok ||
          !payload?.success ||
          !payload?.user ||
          !payload?.profile
        ) {
          throw new Error(payload?.error || 'No active Supabase session');
        }

        if (mounted) {
          setUser(payload.user);
          setProfile(payload.profile);
          setAccount(
            payload.account || {
              id: payload.profile.account_id || '',
              name: 'Clinic Account',
              default_currency: DEFAULT_CURRENCY,
              industry: 'hospital_clinic',
            }
          );
          if (Array.isArray(payload.enabled_modules)) {
            setEnabledModuleKeys(payload.enabled_modules);
          } else if (payload.profile?.account_id) {
            void fetchModules(payload.profile.account_id);
          }
        }
      } catch {
        if (mounted) {
          setUser(null);
          setProfile(null);
          setAccount(null);
          setEnabledModuleKeys([]);
        }
      } finally {
        if (mounted) {
          setProfileLoading(false);
          setLoading(false);
        }
      }
    };

    void init();
    return () => {
      mounted = false;
    };
  }, [fetchModules]);

  const signOut = useCallback(async () => {
    const response = await fetch('/api/auth/logout', { method: 'POST' });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.success) {
      throw new Error(payload?.error || 'Failed to sign out');
    }
    setUser(null);
    setProfile(null);
    setAccount(null);
    setEnabledModuleKeys([]);
    router.replace('/login');
    router.refresh();
  }, [router]);

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
      accountId: profile?.account_id || account?.id || '',
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
