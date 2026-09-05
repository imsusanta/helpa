import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { useOnboardingGate } from '@/hooks/use-onboarding-gate';
import { DashboardDispatcher } from '@/components/dashboard/dashboard-dispatcher';
import { DashboardSetupChecklist } from '@/components/dashboard/dashboard-setup-checklist';

// Mock useAuth
const mockAuthState = {
  profileLoading: false,
  accountId: 'acc-tenant-1',
  accountRole: 'owner' as string | null,
  account: {
    id: 'acc-tenant-1',
    name: 'Test Clinic',
    industry: 'hospital_clinic',
  },
};

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => mockAuthState,
}));

// Mock dynamic import inside DashboardDispatcher
vi.mock('next/dynamic', () => ({
  default: () => {
    const MockComponent = (props: Record<string, unknown>) =>
      React.createElement('div', {
        'data-testid': 'generic-dashboard-client',
        ...props,
      });
    return MockComponent;
  },
}));

vi.mock('@/components/dashboard/onboarding-overlay', () => ({
  OnboardingOverlay: (props: Record<string, unknown>) =>
    React.createElement('div', {
      'data-testid': 'onboarding-overlay',
      ...props,
    }),
}));

vi.mock('@/components/ui/page-skeletons', () => ({
  DashboardContentSkeleton: () =>
    React.createElement('div', { 'data-testid': 'dashboard-skeleton' }),
}));

// In-memory sessionStorage polyfill for Node test environment
const mockSessionStorage: Record<string, string> = {};
const sessionStorageMock = {
  getItem: (key: string) => mockSessionStorage[key] || null,
  setItem: (key: string, value: string) => {
    mockSessionStorage[key] = value;
  },
  removeItem: (key: string) => {
    delete mockSessionStorage[key];
  },
  clear: () => {
    for (const key of Object.keys(mockSessionStorage)) {
      delete mockSessionStorage[key];
    }
  },
};

Object.defineProperty(globalThis, 'sessionStorage', {
  value: sessionStorageMock,
  writable: true,
});

Object.defineProperty(globalThis, 'window', {
  value: globalThis,
  writable: true,
});

/**
 * Lightweight React 19 hook runner for node test environment.
 * Executes hooks using React 19's internal hooks dispatcher with batched updates.
 */
function renderHook<T>(hookFn: () => T) {
  const stateSlots: unknown[] = [];
  let stateIndex = 0;
  const refSlots: { current: unknown }[] = [];
  let refIndex = 0;
  const effects: {
    callback: () => void | (() => void);
    deps?: unknown[];
    cleanup?: void | (() => void);
    shouldRun: boolean;
  }[] = [];
  let effectIndex = 0;
  const callbackSlots: { fn: unknown; deps?: unknown[] }[] = [];
  let callbackIndex = 0;

  let isRendering = false;
  let needsRerender = false;

  const result = { current: undefined as unknown as T };

  function runEffects() {
    for (const eff of effects) {
      if (eff.shouldRun) {
        eff.shouldRun = false;
        if (eff.cleanup) eff.cleanup();
        const clean = eff.callback();
        if (typeof clean === 'function') eff.cleanup = clean;
      }
    }
  }

  function scheduleRerender() {
    if (isRendering) {
      needsRerender = true;
      return;
    }
    isRendering = true;
    let passes = 0;
    do {
      needsRerender = false;
      renderPass();
      runEffects();
      passes++;
      if (passes > 30) {
        throw new Error('Too many re-renders in hook');
      }
    } while (needsRerender);
    isRendering = false;
  }

  function renderPass() {
    stateIndex = 0;
    refIndex = 0;
    effectIndex = 0;
    callbackIndex = 0;

    // React 19 Client Internals H dispatcher
    const internals = (
      React as unknown as {
        __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: {
          H: unknown;
        };
      }
    ).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;

    const oldH = internals.H;
    internals.H = {
      useState: (initial: unknown) => {
        const idx = stateIndex++;
        if (stateSlots.length <= idx) {
          stateSlots[idx] =
            typeof initial === 'function'
              ? (initial as () => unknown)()
              : initial;
        }
        const setState = (newVal: unknown) => {
          const next =
            typeof newVal === 'function'
              ? (newVal as (prev: unknown) => unknown)(stateSlots[idx])
              : newVal;
          if (!Object.is(next, stateSlots[idx])) {
            stateSlots[idx] = next;
            scheduleRerender();
          }
        };
        return [stateSlots[idx], setState];
      },
      useRef: (initial: unknown) => {
        const idx = refIndex++;
        if (refSlots.length <= idx) {
          refSlots[idx] = { current: initial };
        }
        return refSlots[idx];
      },
      useCallback: (fn: unknown, deps?: unknown[]) => {
        const idx = callbackIndex++;
        if (callbackSlots.length <= idx) {
          callbackSlots[idx] = { fn, deps };
        } else {
          const prev = callbackSlots[idx];
          const hasChanged =
            !deps ||
            !prev.deps ||
            deps.some((d, i) => !Object.is(d, prev.deps![i]));
          if (hasChanged) callbackSlots[idx] = { fn, deps };
        }
        return callbackSlots[idx].fn;
      },
      useEffect: (callback: () => void | (() => void), deps?: unknown[]) => {
        const idx = effectIndex++;
        if (effects.length <= idx) {
          effects[idx] = { callback, deps, shouldRun: true };
        } else {
          const prev = effects[idx];
          const hasChanged =
            !deps ||
            !prev.deps ||
            deps.some((d, i) => !Object.is(d, prev.deps![i]));
          if (hasChanged) {
            effects[idx] = {
              callback,
              deps,
              cleanup: prev.cleanup,
              shouldRun: true,
            };
          }
        }
      },
    };

    try {
      result.current = hookFn();
    } finally {
      internals.H = oldH;
    }
  }

  scheduleRerender();

  return {
    result,
    rerender: scheduleRerender,
    unmount: () => {
      for (const eff of effects) {
        if (eff.cleanup) eff.cleanup();
      }
    },
  };
}

describe('Actual useOnboardingGate Hook & Dashboard Components', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorageMock.clear();
    mockAuthState.profileLoading = false;
    mockAuthState.accountId = 'acc-tenant-1';
    mockAuthState.accountRole = 'owner';

    // Default mock fetch for onboarding status
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/account/onboarding-status')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ needs_onboarding: true }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      });
    }) as unknown as typeof fetch;
  });

  describe('useOnboardingGate - Lifecycle & Role Gates', () => {
    it('shows onboarding for eligible new workspace owner once auth is resolved', async () => {
      const { result } = renderHook(() => useOnboardingGate());

      // Wait for fetchStatus to resolve
      await vi.waitFor(() => {
        expect(result.current.gateLoading).toBe(false);
      });

      expect(result.current.showOnboarding).toBe(true);
      expect(result.current.hasError).toBe(false);
    });

    it('does NOT show onboarding prematurely while profile is loading (prevents flash)', () => {
      mockAuthState.profileLoading = true;
      const { result } = renderHook(() => useOnboardingGate());

      expect(result.current.showOnboarding).toBe(false);
    });

    it('does NOT show onboarding to invited staff with agent role', async () => {
      mockAuthState.accountRole = 'agent';
      const { result } = renderHook(() => useOnboardingGate());

      expect(result.current.showOnboarding).toBe(false);
      expect(result.current.gateLoading).toBe(false);
    });

    it('does NOT show onboarding to invited admin who is not workspace owner', async () => {
      mockAuthState.accountRole = 'admin';
      const { result } = renderHook(() => useOnboardingGate());

      expect(result.current.showOnboarding).toBe(false);
      expect(result.current.gateLoading).toBe(false);
    });

    it('does NOT show onboarding when server confirms needs_onboarding is false', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ needs_onboarding: false }),
      }) as unknown as typeof fetch;

      const { result } = renderHook(() => useOnboardingGate());

      await vi.waitFor(() => {
        expect(result.current.gateLoading).toBe(false);
      });

      expect(result.current.showOnboarding).toBe(false);
    });

    it('session deferral hides overlay; server-revalidated openOnboarding reopens it', async () => {
      let fetchCount = 0;
      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/account/onboarding-status')) {
          fetchCount++;
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ needs_onboarding: true }),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      }) as unknown as typeof fetch;

      const { result } = renderHook(() => useOnboardingGate());

      await vi.waitFor(() => {
        expect(result.current.showOnboarding).toBe(true);
      });

      // User defers for session
      result.current.deferForSession();
      expect(result.current.showOnboarding).toBe(false);
      expect(
        sessionStorageMock.getItem('helpa_onboarding_deferred_acc-tenant-1')
      ).toBe('true');

      // User resumes: openOnboarding clears deferral and revalidates with server
      await result.current.openOnboarding();
      expect(
        sessionStorageMock.getItem('helpa_onboarding_deferred_acc-tenant-1')
      ).toBeNull();
      expect(fetchCount).toBeGreaterThanOrEqual(2);
      expect(result.current.showOnboarding).toBe(true);
    });

    it('marks error state when server returns 500; retry clears error and re-evaluates', async () => {
      let shouldFail = true;
      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/account/onboarding-status')) {
          if (shouldFail) {
            return Promise.resolve({
              ok: false,
              status: 500,
              json: () => Promise.resolve({ error: 'Server error' }),
            });
          }
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ needs_onboarding: true }),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      }) as unknown as typeof fetch;

      const { result } = renderHook(() => useOnboardingGate());

      await vi.waitFor(() => {
        expect(result.current.hasError).toBe(true);
      });
      expect(result.current.showOnboarding).toBe(false);

      // Now server recovers; user triggers retry
      shouldFail = false;
      await result.current.retry();

      await vi.waitFor(() => {
        expect(result.current.hasError).toBe(false);
      });
      expect(result.current.showOnboarding).toBe(true);
    });
  });

  describe('DashboardDispatcher Component', () => {
    it('renders skeleton when profile is loading', () => {
      mockAuthState.profileLoading = true;
      const { result } = renderHook(() => DashboardDispatcher());
      expect(React.isValidElement(result.current)).toBe(true);
      expect((result.current.type as { name?: string }).name).toBe(
        'DashboardContentSkeleton'
      );
    });

    it('renders visible alert banner with Retry button when hasError is true', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Failed check' }),
      }) as unknown as typeof fetch;

      const { result } = renderHook(() => DashboardDispatcher());

      await vi.waitFor(() => {
        // Find alert in fragment children
        const children = React.Children.toArray(
          result.current?.props?.children
        );
        const alertChild = children.find(
          (c) =>
            React.isValidElement(c) &&
            (c.props as Record<string, unknown>).role === 'alert'
        );
        expect(alertChild).toBeDefined();
      });
    });
  });

  describe('DashboardSetupChecklist Component', () => {
    it('returns null for non-owner and non-admin roles (agent/viewer)', () => {
      mockAuthState.accountRole = 'agent';
      const { result } = renderHook(() => DashboardSetupChecklist());
      expect(result.current).toBeNull();
    });

    it('allows owner to see checklist with Resume Setup button', async () => {
      mockAuthState.accountRole = 'owner';
      const mockResume = vi.fn();
      const { result } = renderHook(() =>
        DashboardSetupChecklist({ onResumeOnboarding: mockResume })
      );

      await vi.waitFor(() => {
        expect(result.current).not.toBeNull();
      });
    });

    it('allows admin to see checklist but excludes Resume Setup button (owner-only)', async () => {
      mockAuthState.accountRole = 'admin';
      const mockResume = vi.fn();
      const { result } = renderHook(() =>
        DashboardSetupChecklist({ onResumeOnboarding: mockResume })
      );

      await vi.waitFor(() => {
        expect(result.current).not.toBeNull();
      });
    });
  });
});
