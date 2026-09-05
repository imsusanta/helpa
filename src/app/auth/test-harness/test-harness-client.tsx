'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AuthProvider } from '@/hooks/use-auth';
import { OnboardingOverlay } from '@/components/dashboard/onboarding-overlay';
import { DashboardDispatcher } from '@/components/dashboard/dashboard-dispatcher';
import { DashboardSetupChecklist } from '@/components/dashboard/dashboard-setup-checklist';
import { SettingsOverview } from '@/components/settings/settings-overview';

function TestHarnessInner() {
  const searchParams = useSearchParams();
  const scenario = searchParams.get('scenario') || 'overlay';

  const [completed, setCompleted] = useState(false);
  const [deferred, setDeferred] = useState(false);
  const [resumeTriggered, setResumeTriggered] = useState(false);
  const [overlayOpen, setOverlayOpen] = useState(true);

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-white">
      <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-3">
        <h1 className="text-lg font-bold">Helpa UI Test Harness</h1>
        <div className="flex items-center gap-3 text-xs">
          {completed && (
            <span
              data-testid="status-completed"
              className="rounded bg-emerald-500/20 px-2 py-1 text-emerald-400"
            >
              Completed
            </span>
          )}
          {deferred && (
            <span
              data-testid="status-deferred"
              className="rounded bg-amber-500/20 px-2 py-1 text-amber-400"
            >
              Deferred
            </span>
          )}
          {resumeTriggered && (
            <span
              data-testid="status-resumed"
              className="rounded bg-blue-500/20 px-2 py-1 text-blue-400"
            >
              Resumed
            </span>
          )}
        </div>
      </div>

      <AuthProvider>
        {scenario === 'overlay' && (
          <div>
            <div data-testid="harness-mode-overlay">
              <button
                type="button"
                data-testid="reopen-overlay-btn"
                onClick={() => setOverlayOpen(true)}
                className="mb-4 rounded bg-emerald-600 px-3 py-1.5 text-xs font-semibold"
              >
                Reopen Wizard
              </button>
            </div>
            {overlayOpen && (
              <OnboardingOverlay
                onComplete={async () => {
                  setCompleted(true);
                  setOverlayOpen(false);
                }}
                onDefer={() => {
                  setDeferred(true);
                  setOverlayOpen(false);
                }}
              />
            )}
          </div>
        )}

        {scenario === 'dispatcher' && (
          <div data-testid="harness-mode-dispatcher">
            <DashboardDispatcher />
          </div>
        )}

        {scenario === 'checklist' && (
          <div data-testid="harness-mode-checklist">
            <DashboardSetupChecklist
              onResumeOnboarding={() => {
                setResumeTriggered(true);
              }}
            />
          </div>
        )}

        {scenario === 'settings' && (
          <div data-testid="harness-mode-settings">
            <SettingsOverview onSelect={() => {}} />
          </div>
        )}
      </AuthProvider>
    </div>
  );
}

export function TestHarnessClient() {
  return (
    <Suspense fallback={<div>Loading harness...</div>}>
      <TestHarnessInner />
    </Suspense>
  );
}
