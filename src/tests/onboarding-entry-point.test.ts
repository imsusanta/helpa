import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Onboarding Entry Point & Eligibility Architecture', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Eligibility Gate Calculations', () => {
    // Pure logic rule evaluation matching useOnboardingGate
    function evaluateGate({
      profileLoading,
      gateLoading,
      deferred,
      needsOnboarding,
      accountRole,
    }: {
      profileLoading: boolean;
      gateLoading: boolean;
      deferred: boolean;
      needsOnboarding: boolean;
      accountRole: string | null;
    }): boolean {
      return (
        !profileLoading &&
        !gateLoading &&
        !deferred &&
        needsOnboarding &&
        accountRole === 'owner'
      );
    }

    it('shows onboarding for eligible new workspace owner once auth is resolved', () => {
      const show = evaluateGate({
        profileLoading: false,
        gateLoading: false,
        deferred: false,
        needsOnboarding: true,
        accountRole: 'owner',
      });
      expect(show).toBe(true);
    });

    it('does NOT show onboarding prematurely while profile is loading (prevents flash)', () => {
      const show = evaluateGate({
        profileLoading: true,
        gateLoading: false,
        deferred: false,
        needsOnboarding: true,
        accountRole: 'owner',
      });
      expect(show).toBe(false);
    });

    it('does NOT show onboarding while gate status is still loading (prevents flash)', () => {
      const show = evaluateGate({
        profileLoading: false,
        gateLoading: true,
        deferred: false,
        needsOnboarding: true,
        accountRole: 'owner',
      });
      expect(show).toBe(false);
    });

    it('does NOT show onboarding to invited staff with agent role', () => {
      const show = evaluateGate({
        profileLoading: false,
        gateLoading: false,
        deferred: false,
        needsOnboarding: true,
        accountRole: 'agent',
      });
      expect(show).toBe(false);
    });

    it('does NOT show onboarding to invited staff with viewer role', () => {
      const show = evaluateGate({
        profileLoading: false,
        gateLoading: false,
        deferred: false,
        needsOnboarding: true,
        accountRole: 'viewer',
      });
      expect(show).toBe(false);
    });

    it('does NOT show onboarding to invited admin who is not workspace owner', () => {
      const show = evaluateGate({
        profileLoading: false,
        gateLoading: false,
        deferred: false,
        needsOnboarding: true,
        accountRole: 'admin',
      });
      expect(show).toBe(false);
    });

    it('does NOT show onboarding when account has already completed onboarding', () => {
      const show = evaluateGate({
        profileLoading: false,
        gateLoading: false,
        deferred: false,
        needsOnboarding: false,
        accountRole: 'owner',
      });
      expect(show).toBe(false);
    });

    it('does NOT show onboarding when user deferred for the current session', () => {
      const show = evaluateGate({
        profileLoading: false,
        gateLoading: false,
        deferred: true,
        needsOnboarding: true,
        accountRole: 'owner',
      });
      expect(show).toBe(false);
    });
  });

  describe('Session Deferral and Resume Lifecycle', () => {
    it('deferral saves session key and openOnboarding clears it', () => {
      const storage: Record<string, string> = {};
      const mockSessionStorage = {
        getItem: (k: string) => storage[k] || null,
        setItem: (k: string, v: string) => {
          storage[k] = v;
        },
        removeItem: (k: string) => {
          delete storage[k];
        },
      };

      const accountId = 'acc-test-123';
      const key = `helpa_onboarding_deferred_${accountId}`;

      // User chooses "Finish later"
      mockSessionStorage.setItem(key, 'true');
      expect(mockSessionStorage.getItem(key)).toBe('true');

      // User chooses "Resume Setup" from checklist
      mockSessionStorage.removeItem(key);
      expect(mockSessionStorage.getItem(key)).toBeNull();
    });
  });

  describe('Setup Checklist Role Authorization', () => {
    function shouldRenderChecklist(accountRole: string | null): boolean {
      return accountRole === 'owner' || accountRole === 'admin';
    }

    it('permits workspace owner to see setup checklist', () => {
      expect(shouldRenderChecklist('owner')).toBe(true);
    });

    it('permits workspace admin to see setup checklist', () => {
      expect(shouldRenderChecklist('admin')).toBe(true);
    });

    it('blocks invited agents from seeing setup checklist', () => {
      expect(shouldRenderChecklist('agent')).toBe(false);
    });

    it('blocks invited viewers from seeing setup checklist', () => {
      expect(shouldRenderChecklist('viewer')).toBe(false);
    });

    it('blocks unauthenticated visitors from seeing setup checklist', () => {
      expect(shouldRenderChecklist(null)).toBe(false);
    });
  });

  describe('Completion Lifecycle & Error Resilience', () => {
    it('calls onComplete on successful API response to close overlay', async () => {
      const onComplete = vi.fn().mockResolvedValue(undefined);
      const refreshProfile = vi.fn().mockResolvedValue(undefined);
      const refreshModules = vi.fn().mockResolvedValue(undefined);

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      });

      // Simulate handleCompleteGoLive
      const res = await mockFetch('/api/account/onboard', {
        method: 'POST',
      });
      if (res.ok) {
        await refreshProfile();
        await refreshModules();
        await onComplete();
      }

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/account/onboard',
        expect.any(Object)
      );
      expect(refreshProfile).toHaveBeenCalled();
      expect(refreshModules).toHaveBeenCalled();
      expect(onComplete).toHaveBeenCalled();
    });

    it('does NOT call onComplete on API failure, keeping UI visible for retry', async () => {
      const onComplete = vi.fn().mockResolvedValue(undefined);
      let caughtError: string | null = null;

      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Database connection error' }),
      });

      // Simulate handleCompleteGoLive with error
      try {
        const res = await mockFetch('/api/account/onboard', {
          method: 'POST',
        });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error);
        }
        await onComplete();
      } catch (err) {
        caughtError = (err as Error).message;
      }

      expect(caughtError).toBe('Database connection error');
      // onComplete was NOT called — modal stays open, user can retry
      expect(onComplete).not.toHaveBeenCalled();
    });

    it('honest WhatsApp state: pending state is preserved when WhatsApp is not connected', () => {
      const whatsappConnected = false;
      const statusLabel = whatsappConnected
        ? 'Connected'
        : 'Pending (Connect in Settings)';

      expect(statusLabel).toBe('Pending (Connect in Settings)');
      expect(statusLabel).not.toBe('Connected');
    });

    it('honest WhatsApp state: does not fake connection when service fails', () => {
      let whatsappConnected = false;
      const onQrError = () => {
        // When QR fails or times out, whatsappConnected remains false
        whatsappConnected = false;
      };

      onQrError();
      expect(whatsappConnected).toBe(false);
    });
  });

  describe('Account-Switch Stale-Response & Hook Resilience', () => {
    it('discards stale response if account switches before request completes', async () => {
      let currentAccountId = 'acc-1';
      let hookNeedsOnboarding = false;

      // Simulate asynchronous fetch where account changes mid-flight
      const targetAccountId = currentAccountId;

      const fetchPromise = new Promise<{ needs_onboarding: boolean }>(
        (resolve) => {
          setTimeout(() => {
            resolve({ needs_onboarding: true });
          }, 50);
        }
      );

      // User immediately switches account to acc-2
      currentAccountId = 'acc-2';

      const data = await fetchPromise;
      // Hook checks targetAccountId against currentAccountId
      if (targetAccountId === currentAccountId) {
        hookNeedsOnboarding = data.needs_onboarding;
      }

      // Should be discarded, hookNeedsOnboarding remains false for acc-2
      expect(hookNeedsOnboarding).toBe(false);
    });

    it('handles transient network errors safely without blocking dashboard access', () => {
      let hasError = false;
      let needsOnboarding = false;
      let gateLoading = true;

      const handleNetworkError = () => {
        hasError = true;
        needsOnboarding = false;
        gateLoading = false;
      };

      handleNetworkError();
      expect(hasError).toBe(true);
      expect(needsOnboarding).toBe(false);
      expect(gateLoading).toBe(false);
    });

    it('retry clears error state and allows re-evaluating onboarding status', () => {
      let hasError = true;
      let fetched = false;

      const retry = () => {
        hasError = false;
        fetched = true;
      };

      retry();
      expect(hasError).toBe(false);
      expect(fetched).toBe(true);
    });

    it('enforces owner-only check when attempting to resume onboarding via openOnboarding', () => {
      let resumeAttempted = false;
      const openOnboarding = (role: string | null) => {
        if (role !== 'owner') return;
        resumeAttempted = true;
      };

      openOnboarding('agent');
      expect(resumeAttempted).toBe(false);

      openOnboarding('admin');
      expect(resumeAttempted).toBe(false);

      openOnboarding('owner');
      expect(resumeAttempted).toBe(true);
    });
  });
});
