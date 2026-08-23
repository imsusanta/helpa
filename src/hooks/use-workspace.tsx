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
import { isIndustryRouteAllowed } from '@/modules/routes';

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
    () => (pathname: string) => isIndustryRouteAllowed(manifest, pathname),
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
