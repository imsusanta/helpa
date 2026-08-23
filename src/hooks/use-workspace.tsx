'use client';

import { useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { getIndustryModule } from '@/modules/registry';
import type {
  IndustryModule,
  IndustryTerminology,
  IndustryFeatures,
} from '@/modules/types';
import {
  GENERAL_INDUSTRY_TERMINOLOGY,
  getIndustryTerminology,
  resolveIndustryAlias,
} from '@/modules/terminology';

export const DEFAULT_TERMINOLOGY = GENERAL_INDUSTRY_TERMINOLOGY;

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

  const currentIndustry = resolveIndustryAlias(account?.industry);

  const manifest = useMemo(() => {
    return getIndustryModule(account?.industry);
  }, [account?.industry]);

  const terminology = useMemo<IndustryTerminology>(() => {
    return getIndustryTerminology(account?.industry, manifest.terminology);
  }, [account?.industry, manifest.terminology]);

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
        pathname === '/campaign-reports' ||
        pathname.startsWith('/campaign-reports/') ||
        pathname === '/lead-forms' ||
        pathname.startsWith('/lead-forms/') ||
        pathname === '/knowledge-base' ||
        pathname.startsWith('/knowledge-base/') ||
        pathname === '/chatbot' ||
        pathname.startsWith('/chatbot/') ||
        pathname === '/faq-bot' ||
        pathname.startsWith('/faq-bot/') ||
        pathname === '/ai-assistant' ||
        pathname.startsWith('/ai-assistant/') ||
        pathname === '/admin' ||
        pathname.startsWith('/admin/') ||
        pathname === '/billing' ||
        pathname.startsWith('/billing/') ||
        pathname === '/automations' ||
        pathname.startsWith('/automations/') ||
        pathname === '/integrations' ||
        pathname.startsWith('/integrations/') ||
        pathname === '/pipelines' ||
        pathname.startsWith('/pipelines/')
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
