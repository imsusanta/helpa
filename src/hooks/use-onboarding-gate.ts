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
 * - Account-switch stale-response protection: tracks active account ID and
 *   discards responses from prior accounts.
 * - Calling `markComplete()` clears the flag immediately in the UI, then
 *   re-fetches the server to confirm.
 * - Calling `deferForSession()` hides the overlay for the current browser
 *   session without marking onboarding as complete.
 * - Provides retry controls for handling transient/unknown status errors.
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';

export interface OnboardingGateResult {
  /** True only once auth is resolved and server confirms needs_onboarding. */
  showOnboarding: boolean;
  /** Whether the status is still being fetched. */
  gateLoading: boolean;
  /** Whether the status fetch encountered an error. */
  hasError: boolean;
  /** Retry fetching onboarding status. */
  retry: () => Promise<void>;
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
   * Re-open the onboarding wizard after it was deferred for the session (owner-only).
   */
  openOnboarding: () => void;
}

const SESSION_DEFER_KEY = 'helpa_onboarding_deferred';

export function useOnboardingGate(): OnboardingGateResult {
  const { profileLoading, accountRole, accountId } = useAuth();

  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [deferred, setDeferred] = useState(false);
  const [gateLoading, setGateLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const currentAccountIdRef = useRef(accountId);
  const fetchedRef = useRef(false);

  // Reset state when tenant account switches to prevent stale response pollution
  useEffect(() => {
    currentAccountIdRef.current = accountId;
    fetchedRef.current = false;
    setNeedsOnboarding(false);
    setDeferred(false);
    setGateLoading(Boolean(accountId && accountRole === 'owner'));
    setHasError(false);
  }, [accountId, accountRole]);

  const fetchStatus = useCallback(async () => {
    const targetAccountId = currentAccountIdRef.current;
    if (!targetAccountId) {
      setGateLoading(false);
      return;
    }

    setGateLoading(true);
    setHasError(false);

    try {
      const res = await fetch('/api/account/onboarding-status', {
        cache: 'no-store',
        credentials: 'same-origin',
      });

      // Discard response if tenant account switched during in-flight fetch
      if (currentAccountIdRef.current !== targetAccountId) return;

      if (res.status === 403) {
        // Non-owner — never show onboarding
        setNeedsOnboarding(false);
        setGateLoading(false);
        return;
      }

      if (!res.ok) {
        // Mark error state so retry is possible, but fail open for dashboard access
        setHasError(true);
        setNeedsOnboarding(false);
        setGateLoading(false);
        return;
      }

      const data = await res.json().catch(() => ({ needs_onboarding: false }));
      if (currentAccountIdRef.current !== targetAccountId) return;

      setNeedsOnboarding(Boolean(data?.needs_onboarding));
    } catch {
      if (currentAccountIdRef.current !== targetAccountId) return;
      setHasError(true);
      setNeedsOnboarding(false);
    } finally {
      if (currentAccountIdRef.current === targetAccountId) {
        setGateLoading(false);
      }
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
      const isDeferred = window.sessionStorage.getItem(
        `${SESSION_DEFER_KEY}_${accountId}`
      );
      if (isDeferred === 'true') {
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
    // Re-fetch from server to confirm
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
    // Owner-only validated resume
    if (accountRole !== 'owner') return;
    setDeferred(false);
    setNeedsOnboarding(true);
    if (typeof window !== 'undefined' && accountId) {
      window.sessionStorage.removeItem(`${SESSION_DEFER_KEY}_${accountId}`);
    }
  }, [accountId, accountRole]);

  const retry = useCallback(async () => {
    fetchedRef.current = false;
    await fetchStatus();
  }, [fetchStatus]);

  const showOnboarding =
    !profileLoading &&
    !gateLoading &&
    !deferred &&
    needsOnboarding &&
    accountRole === 'owner';

  return {
    showOnboarding,
    gateLoading,
    hasError,
    retry,
    markComplete,
    deferForSession,
    openOnboarding,
  };
}
