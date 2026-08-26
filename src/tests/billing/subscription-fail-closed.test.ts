import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  checkFeatureAccess,
  checkPlanLimits,
  getWorkspaceSubscription,
  hasPaidAccess,
  SubscriptionLookupError,
} from '@/lib/saas/subscription';

/**
 * Fail-closed billing state machine:
 * - Missing subscription rows never become ACTIVE paid plans.
 * - Database errors deny access with a generic reason.
 * - Inactive lifecycle statuses never receive paid access.
 */

const state = vi.hoisted(() => ({
  subscriptionRow: null as Record<string, unknown> | null,
  subscriptionError: null as { message: string } | null,
  usageError: null as { message: string } | null,
  contactsCount: 0,
}));

vi.mock('@/lib/db/server', () => {
  const makeBuilder = (table: string) => {
    const chain: Record<string, unknown> = {
      select: () => chain,
      eq: () => chain,
      in: () => chain,
      lt: () => chain,
      order: () => chain,
      limit: () => chain,
      maybeSingle: async () => {
        if (table === 'subscriptions') {
          return {
            data: state.subscriptionError ? null : state.subscriptionRow,
            error: state.subscriptionError,
          };
        }
        if (table === 'usage_tracking') {
          return { data: null, error: state.usageError };
        }
        return { data: null, error: null };
      },
      then: (
        resolve: (v: { data: unknown[]; error: null }) => unknown,
        reject?: (e: unknown) => unknown
      ) => Promise.resolve({ data: [], error: null }).then(resolve, reject),
    };
    return chain;
  };

  return {
    getAdminClient: () => ({
      from: (table: string) => {
        if (table === 'contacts' || table === 'profiles') {
          const counted: Record<string, unknown> = {
            select: () => counted,
            eq: async () => ({ count: state.contactsCount, error: null }),
          };
          // The route chains .select(...,{count}).eq(...) and awaits the
          // final eq. Model that exact shape.
          return {
            select: () => ({
              eq: async () => ({ count: state.contactsCount, error: null }),
            }),
          };
        }
        return makeBuilder(table);
      },
    }),
  };
});

const ACTIVE_GROWTH_ROW = {
  id: 'sub-1',
  account_id: 'acc-1',
  plan_slug: 'growth',
  status: 'ACTIVE',
  setup_fee_paid: true,
  end_date: new Date(Date.now() + 10 * 86400_000).toISOString(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

beforeEach(() => {
  state.subscriptionRow = null;
  state.subscriptionError = null;
  state.usageError = null;
  state.contactsCount = 0;
});

describe('getWorkspaceSubscription (fail closed)', () => {
  it('represents a missing subscription as PENDING_PAYMENT with setupFeePaid=false', async () => {
    const { subscription, hasSubscriptionRow } =
      await getWorkspaceSubscription('acc-none');
    expect(hasSubscriptionRow).toBe(false);
    expect(subscription.status).toBe('PENDING_PAYMENT');
    expect(subscription.setupFeePaid).toBe(false);
  });

  it('never infers the plan from accountId strings', async () => {
    const { subscription } = await getWorkspaceSubscription(
      'account-with-pro-in-the-name'
    );
    expect(subscription.status).toBe('PENDING_PAYMENT');
    // planSlug stays undefined because there is no persisted row.
    expect(subscription.planSlug).toBeUndefined();
  });

  it('throws on a database error instead of synthesizing paid access', async () => {
    state.subscriptionError = { message: 'connection refused' };
    await expect(getWorkspaceSubscription('acc-1')).rejects.toBeInstanceOf(
      SubscriptionLookupError
    );
  });

  it('fails closed for rows with an unknown plan identifier', async () => {
    state.subscriptionRow = { ...ACTIVE_GROWTH_ROW, plan_slug: 'mystery' };
    await expect(getWorkspaceSubscription('acc-1')).rejects.toThrow(/mystery/);
  });

  it('loads an ACTIVE row from persisted data only', async () => {
    state.subscriptionRow = ACTIVE_GROWTH_ROW;
    const { subscription, plan } = await getWorkspaceSubscription('acc-1');
    expect(subscription.status).toBe('ACTIVE');
    expect(subscription.setupFeePaid).toBe(true);
    expect(plan.slug).toBe('growth');
  });
});

describe('hasPaidAccess status policy', () => {
  it.each(['ACTIVE', 'TRIALING'] as const)('%s has access', (status) => {
    expect(hasPaidAccess({ status, gracePeriodEnd: undefined })).toBe(true);
  });

  it.each([
    'PENDING_PAYMENT',
    'INCOMPLETE',
    'PAUSED',
    'CANCELLED',
    'EXPIRED',
    'TRIAL_EXPIRED',
  ] as const)('%s never has access', (status) => {
    expect(hasPaidAccess({ status, gracePeriodEnd: undefined })).toBe(false);
  });

  it('PAST_DUE has access only inside an unexpired grace period', () => {
    const future = new Date(Date.now() + 86400_000).toISOString();
    const past = new Date(Date.now() - 86400_000).toISOString();
    expect(
      hasPaidAccess({ status: 'PAST_DUE', gracePeriodEnd: future } as never)
    ).toBe(true);
    expect(
      hasPaidAccess({ status: 'PAST_DUE', gracePeriodEnd: past } as never)
    ).toBe(false);
    expect(
      hasPaidAccess({ status: 'PAST_DUE', gracePeriodEnd: undefined } as never)
    ).toBe(false);
  });
});

describe('checkFeatureAccess (fail closed)', () => {
  it('denies when no subscription exists', async () => {
    const res = await checkFeatureAccess('acc-none', 'core.inbox');
    expect(res.allowed).toBe(false);
    expect(res.reason).toMatch(/no active subscription/i);
  });

  it('denies on database errors with a generic reason (no internals leaked)', async () => {
    state.subscriptionError = {
      message: 'FATAL: password authentication failed for role postgres',
    };
    const res = await checkFeatureAccess('acc-1', 'core.inbox');
    expect(res.allowed).toBe(false);
    expect(res.reason).not.toMatch(/postgres|password|FATAL/i);
    expect(res.reason).toMatch(/try again/i);
  });

  it.each(['CANCELLED', 'EXPIRED', 'TRIAL_EXPIRED', 'PAUSED', 'INCOMPLETE'])(
    'denies %s subscriptions',
    async (status) => {
      state.subscriptionRow = { ...ACTIVE_GROWTH_ROW, status };
      const res = await checkFeatureAccess('acc-1', 'core.inbox');
      expect(res.allowed).toBe(false);
    }
  );

  it('denies PAST_DUE after the grace period has passed', async () => {
    state.subscriptionRow = {
      ...ACTIVE_GROWTH_ROW,
      status: 'PAST_DUE',
      grace_period_end: new Date(Date.now() - 3600_000).toISOString(),
    };
    const res = await checkFeatureAccess('acc-1', 'core.inbox');
    expect(res.allowed).toBe(false);
  });

  it('allows PAST_DUE inside the grace period', async () => {
    state.subscriptionRow = {
      ...ACTIVE_GROWTH_ROW,
      status: 'PAST_DUE',
      grace_period_end: new Date(Date.now() + 3600_000).toISOString(),
    };
    const res = await checkFeatureAccess('acc-1', 'core.inbox');
    expect(res.allowed).toBe(true);
  });

  it('grants Pro features via explicit entitlements, not a slug bypass', async () => {
    state.subscriptionRow = { ...ACTIVE_GROWTH_ROW, plan_slug: 'pro' };
    const custom = await checkFeatureAccess('acc-1', 'core.custom_models');
    expect(custom.allowed).toBe(true);

    // A feature key outside the Pro entitlement list is denied even for Pro.
    const madeUp = await checkFeatureAccess('acc-1', 'core.made_up_feature');
    expect(madeUp.allowed).toBe(false);
  });

  it('denies plan features the subscription does not include', async () => {
    state.subscriptionRow = { ...ACTIVE_GROWTH_ROW, plan_slug: 'starter' };
    const res = await checkFeatureAccess('acc-1', 'core.ai_copilot');
    expect(res.allowed).toBe(false);
  });
});

describe('checkPlanLimits (fail closed)', () => {
  it('denies when no subscription exists', async () => {
    const res = await checkPlanLimits('acc-none', 'max_contacts');
    expect(res.allowed).toBe(false);
    expect(res.limit).toBe(0);
  });

  it('denies on subscription database errors', async () => {
    state.subscriptionError = { message: 'boom' };
    const res = await checkPlanLimits('acc-1', 'max_contacts');
    expect(res.allowed).toBe(false);
    expect(res.reason).toMatch(/try again/i);
  });

  it('denies on usage-tracking database errors', async () => {
    state.subscriptionRow = ACTIVE_GROWTH_ROW;
    state.usageError = { message: 'usage table unavailable' };
    const res = await checkPlanLimits('acc-1', 'max_ai_requests');
    expect(res.allowed).toBe(false);
    expect(res.reason).not.toMatch(/unavailable/);
  });

  it('allows usage within the plan limit for an ACTIVE subscription', async () => {
    state.subscriptionRow = ACTIVE_GROWTH_ROW;
    state.contactsCount = 5;
    const res = await checkPlanLimits('acc-1', 'max_contacts');
    expect(res.allowed).toBe(true);
    expect(res.limit).toBe(10000);
    expect(res.currentUsage).toBe(5);
  });
});
