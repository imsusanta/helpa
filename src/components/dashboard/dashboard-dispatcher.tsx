'use client';

import { useAuth } from '@/hooks/use-auth';
import { OnboardingOverlay } from './onboarding-overlay';
import { ClinicalDashboardClient } from './clinical-dashboard-client';
import { GenericDashboardClient } from './generic-dashboard-client';
import { Loader2 } from 'lucide-react';

export function DashboardDispatcher() {
  const { account, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // If no industry has been selected, force onboarding wizard overlay
  if (!account || !account.industry || account.industry === 'general') {
    return <OnboardingOverlay />;
  }

  // Dispatch to the matching dashboard client
  if (account.industry === 'hospital_clinic') {
    return <ClinicalDashboardClient />;
  }

  return <GenericDashboardClient />;
}
