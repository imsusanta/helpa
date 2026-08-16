'use client';

import { useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { getIndustryModule } from '@/modules/registry';
import type {
  IndustryModule,
  IndustryTerminology,
  IndustryFeatures,
} from '@/modules/types';

export const DEFAULT_TERMINOLOGY: IndustryTerminology = {
  contact: 'Contact',
  contacts: 'Contacts',
  booking: 'Booking',
  bookings: 'Bookings',
  staff: 'Staff Member',
  staffMembers: 'Staff Members',
  service: 'Service',
  services: 'Services',
};

export interface WorkspaceContextValue {
  currentWorkspace: ReturnType<typeof useAuth>['account'];
  currentIndustry: string;
  manifest: IndustryModule;
  terminology: IndustryTerminology;
  features: IndustryFeatures;
  aiRole: string;
  isFeatureEnabled: (featureKey: string) => boolean;
  isRouteAllowed: (pathname: string) => boolean;
  loading: boolean;
}

export function useWorkspace(): WorkspaceContextValue {
  const { account, profileLoading, loading: authLoading } = useAuth();

  const currentIndustry = account?.industry || 'health';

  const manifest = useMemo(() => {
    return getIndustryModule(account?.industry);
  }, [account?.industry]);

  const terminology = useMemo<IndustryTerminology>(() => {
    return manifest.terminology || DEFAULT_TERMINOLOGY;
  }, [manifest]);

  const features = useMemo<IndustryFeatures>(() => {
    return manifest.features || {};
  }, [manifest]);

  const aiRole = useMemo(() => {
    return manifest.aiRole || 'AI Assistant';
  }, [manifest]);

  const isFeatureEnabled = useMemo(
    () => (featureKey: string) => {
      if (!manifest.features) return true;
      return manifest.features[featureKey] ?? true;
    },
    [manifest]
  );

  const isRouteAllowed = useMemo(
    () => (pathname: string) => {
      // Core platform routes always allowed across all workspace industries
      if (
        pathname === '/dashboard' ||
        pathname.startsWith('/dashboard/') ||
        pathname === '/inbox' ||
        pathname.startsWith('/inbox/') ||
        pathname === '/settings' ||
        pathname.startsWith('/settings/') ||
        pathname === '/broadcasts' ||
        pathname.startsWith('/broadcasts/') ||
        pathname === '/knowledge-base' ||
        pathname.startsWith('/knowledge-base/') ||
        pathname === '/admin' ||
        pathname.startsWith('/admin/') ||
        pathname === '/billing' ||
        pathname.startsWith('/billing/') ||
        pathname === '/automations' ||
        pathname.startsWith('/automations/')
      ) {
        return true;
      }

      if (!manifest.allowedRoutes || manifest.allowedRoutes.length === 0) {
        return true;
      }

      return manifest.allowedRoutes.some((route) => pathname.startsWith(route));
    },
    [manifest]
  );

  return {
    currentWorkspace: account,
    currentIndustry,
    manifest,
    terminology,
    features,
    aiRole,
    isFeatureEnabled,
    isRouteAllowed,
    loading: authLoading || profileLoading,
  };
}
