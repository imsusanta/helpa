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
  const {
    showOnboarding,
    markComplete,
    deferForSession,
    openOnboarding,
    hasError,
    retry,
  } = useOnboardingGate();

  if (profileLoading) return <DashboardContentSkeleton />;

  return (
    <>
      {hasError && (
        <div
          role="alert"
          className="mx-4 mt-3 flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-900 dark:text-amber-200"
        >
          <div className="flex items-center gap-2">
            <span className="font-semibold">⚠️ Setup status check failed:</span>
            <span>
              Unable to verify onboarding progress. Your dashboard is
              accessible.
            </span>
          </div>
          <button
            type="button"
            onClick={() => void retry()}
            className="rounded bg-amber-500/20 px-2.5 py-1 font-semibold text-amber-900 transition hover:bg-amber-500/30 dark:text-amber-200"
          >
            Retry Check
          </button>
        </div>
      )}
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
