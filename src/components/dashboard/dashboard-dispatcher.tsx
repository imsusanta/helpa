'use client';

import dynamic from 'next/dynamic';
import { useAuth } from '@/hooks/use-auth';
import { useOnboardingGate } from '@/hooks/use-onboarding-gate';
import { DashboardContentSkeleton } from '@/components/ui/page-skeletons';
import { OnboardingOverlay } from './onboarding-overlay';

const GenericDashboardClient = dynamic(
  () =>
    import('./generic-dashboard-client').then(
      (module) => module.GenericDashboardClient
    ),
  {
    loading: () => <DashboardContentSkeleton />,
    ssr: false,
  }
);

export function DashboardDispatcher() {
  const { profileLoading } = useAuth();
  const { showOnboarding, markComplete, deferForSession, openOnboarding } =
    useOnboardingGate();

  if (profileLoading) return <DashboardContentSkeleton />;

  return (
    <>
      <GenericDashboardClient onResumeOnboarding={openOnboarding} />
      {showOnboarding && (
        <OnboardingOverlay
          onComplete={markComplete}
          onDefer={deferForSession}
        />
      )}
    </>
  );
}
