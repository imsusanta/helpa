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
import { DEFAULT_CURRENCY } from '@/lib/currency';
import {
  canEditSettings as canEditSettingsFor,
  canManageMembers as canManageMembersFor,
  canSendMessages as canSendMessagesFor,
  type AccountRole,
} from '@/lib/auth/roles';

export interface AuthUser {
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
  user: AuthUser | null;
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
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [account, setAccount] = useState<AccountSummary | null>(null);
  const [enabledModuleKeys, setEnabledModuleKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);
  const [modulesLoading, setModulesLoading] = useState(false);

  const fetchProfile = useCallback(async (_userId: string) => {
    setProfileLoading(true);
    try {
      const response = await fetch('/api/account/profile').catch(() => null);
      const data = response?.ok
        ? await response.json().catch(() => null)
        : null;
      if (data?.success && data?.profile) {
        setProfile(data.profile);
        setAccount(
          data.account || {
            id: data.profile.account_id || null,
            name: 'Clinic Account',
            default_currency: DEFAULT_CURRENCY,
            industry: 'hospital_clinic',
          }
        );
      } else {
        setProfile(null);
        setAccount(null);
      }
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
    const initialize = async () => {
      try {
        const response = await fetch('/api/auth/me').catch(() => null);
        const data = response?.ok
          ? await response.json().catch(() => null)
          : null;
        if (mounted && data?.success && data?.user) {
          setUser(data.user);
          void fetchProfile(data.user.id);
        } else if (mounted) {
          setUser(null);
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
    void initialize();
    return () => {
      mounted = false;
    };
  }, [fetchProfile]);

  const signOut = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      setUser(null);
      setProfile(null);
      setAccount(null);
      window.location.href = `${window.location.origin}/login`;
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user?.id) await fetchProfile(user.id);
  }, [user?.id, fetchProfile]);

  const refreshModules = useCallback(async () => {
    if (profile?.account_id) await fetchModules(profile.account_id);
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
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
