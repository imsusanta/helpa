/**
 * useOnboardingGate
 *
 * Returns whether the authenticated owner should see the guided onboarding
 * wizard. Fetches once from /api/account/onboarding-status after auth is
 * resolved. Re-fetches when `refresh()` is called (e.g. after completion).
 *
 * Rules:
 * - Never shows while auth/profile is still loading (no flash).
 * - Only shows to account owners (role check enforced server-side; hook
 *   additionally checks accountRole client-side as a UI guard).
 * - Calling `markComplete()` clears the flag immediately in the UI, then
 *   re-fetches the server to confirm.
 * - Calling `deferForSession()` hides the overlay for the current browser
 *   session without marking onboarding as complete.
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';

interface OnboardingGateResult {
  /** True only once auth is resolved and server confirms needs_onboarding. */
  showOnboarding: boolean;
  /** Whether the status is still being fetched. */
  gateLoading: boolean;
  /**
   * Call after a successful onboarding completion. Immediately hides the
   * overlay in the UI and re-fetches the server to confirm.
   */
  markComplete: () => Promise<void>;
  /**
   * Hide the overlay for this browser session without marking onboarding
   * complete. The wizard will reappear on next page load.
   */
  deferForSession: () => void;
  /**
   * Re-open the onboarding wizard after it was deferred for the session.
   */
  openOnboarding: () => void;
}

const SESSION_DEFER_KEY = 'helpa_onboarding_deferred';

export function useOnboardingGate(): OnboardingGateResult {
  const { profileLoading, accountRole, accountId } = useAuth();

  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [deferred, setDeferred] = useState(false);
  const [gateLoading, setGateLoading] = useState(true);
  const fetchedRef = useRef(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/account/onboarding-status', {
        cache: 'no-store',
        credentials: 'same-origin',
      });
      if (res.status === 403) {
        // Non-owner — never show onboarding
        setNeedsOnboarding(false);
        return;
      }
      if (!res.ok) {
        // Fail open — network error should not block the dashboard
        setNeedsOnboarding(false);
        return;
      }
      const data = await res.json().catch(() => ({ needs_onboarding: false }));
      setNeedsOnboarding(Boolean(data?.needs_onboarding));
    } catch {
      setNeedsOnboarding(false);
    } finally {
      setGateLoading(false);
    }
  }, []);

  useEffect(() => {
    if (profileLoading) return;
    if (!accountId) {
      setGateLoading(false);
      return;
    }
    // Non-owners never see the wizard — skip the network call entirely
    if (accountRole !== 'owner') {
      setGateLoading(false);
      return;
    }
    // Check session-level deferral
    if (typeof window !== 'undefined') {
      const deferred = window.sessionStorage.getItem(
        `${SESSION_DEFER_KEY}_${accountId}`
      );
      if (deferred === 'true') {
        setDeferred(true);
        setGateLoading(false);
        return;
      }
    }
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    void fetchStatus();
  }, [profileLoading, accountId, accountRole, fetchStatus]);

  const markComplete = useCallback(async () => {
    // Immediately hide in UI — don't wait for network
    setNeedsOnboarding(false);
    // Re-fetch from server to confirm (resets fetchedRef so it runs)
    fetchedRef.current = false;
    await fetchStatus();
  }, [fetchStatus]);

  const deferForSession = useCallback(() => {
    setDeferred(true);
    if (typeof window !== 'undefined' && accountId) {
      window.sessionStorage.setItem(
        `${SESSION_DEFER_KEY}_${accountId}`,
        'true'
      );
    }
  }, [accountId]);

  const openOnboarding = useCallback(() => {
    setDeferred(false);
    setNeedsOnboarding(true);
    if (typeof window !== 'undefined' && accountId) {
      window.sessionStorage.removeItem(`${SESSION_DEFER_KEY}_${accountId}`);
    }
  }, [accountId]);

  const showOnboarding =
    !profileLoading &&
    !gateLoading &&
    !deferred &&
    needsOnboarding &&
    accountRole === 'owner';

  return {
    showOnboarding,
    gateLoading,
    markComplete,
    deferForSession,
    openOnboarding,
  };
}
