import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  startFreeTrial,
  cancelSubscription,
  reactivateSubscription,
  handlePaymentFailure,
  upgradeSubscription,
} from '@/core/billing/subscription.service';
import { expireStaleTrials } from '@/lib/saas/subscription';

/**
 * Lifecycle transitions write canonical state to public.subscriptions:
 * - trial start → TRIALING
 * - payment failure → PAST_DUE with grace_period_end
 * - grace expiry → EXPIRED (cron)
 * - period-end cancel → stays ACTIVE with cancel_at_period_end=true
 * - immediate cancel → CANCELLED with cancel_at_period_end=false
 * - reactivate → ACTIVE with cancellation flags cleared
 */

const state = vi.hoisted(() => ({
  subscriptions: [] as Array<Record<string, unknown>>,
  accounts: [] as Array<Record<string, unknown>>,
}));

vi.mock('@/lib/db/server', () => {
  const tableFor = (name: string): Array<Record<string, unknown>> => {
    if (name === 'subscriptions') return state.subscriptions;
    if (name === 'accounts') return state.accounts;
    return [];
  };

  return {
    getAdminClient: () => ({
      from: (table: string) => {
        const rows = tableFor(table);
        const filters: Array<[string, 'eq' | 'in' | 'lt', unknown]> = [];
        const applyFilters = () =>
          rows.filter((r) =>
            filters.every(([col, op, val]) => {
              if (op === 'eq') return r[col] === val;
              if (op === 'in') return (val as unknown[]).includes(r[col]);
              return r[col] != null && String(r[col]) < String(val as string);
            })
          );

        const chain: Record<string, unknown> = {
          select: () => chain,
          eq: (col: string, val: unknown) => {
            filters.push([col, 'eq', val]);
            return chain;
          },
          in: (col: string, val: unknown[]) => {
            filters.push([col, 'in', val]);
            return chain;
          },
          lt: (col: string, val: unknown) => {
            filters.push([col, 'lt', val]);
            return chain;
          },
          maybeSingle: async () => ({
            data: applyFilters()[0] ?? null,
            error: null,
          }),
          insert: async (payload: Record<string, unknown>) => {
            rows.push({ id: `row-${rows.length + 1}`, ...payload });
            return { data: null, error: null };
          },
          update: (payload: Record<string, unknown>) => ({
            eq: async (col: string, val: unknown) => {
              rows
                .filter((r) => r[col] === val)
                .forEach((r) => Object.assign(r, payload));
              return { data: null, error: null };
            },
          }),
          then: (
            resolve: (v: { data: unknown[]; error: null }) => unknown,
            reject?: (e: unknown) => unknown
          ) =>
            Promise.resolve({ data: applyFilters(), error: null }).then(
              resolve,
              reject
            ),
        };
        return chain;
      },
    }),
  };
});

function subRow(accountId: string): Record<string, unknown> | undefined {
  return state.subscriptions.find((s) => s.account_id === accountId);
}

beforeEach(() => {
  state.subscriptions.length = 0;
  state.accounts.length = 0;
  state.accounts.push({ id: 'acc-1', subscription_status: 'ACTIVE' });
});

describe('subscription lifecycle transitions', () => {
  it('startFreeTrial writes a canonical TRIALING row with an unpaid setup fee', async () => {
    const sub = await startFreeTrial({
      workspaceId: 'acc-1',
      planId: 'plan_growth',
      trialDays: 14,
    });

    expect(sub.status).toBe('TRIALING');
    const row = subRow('acc-1');
    expect(row?.status).toBe('TRIALING');
    expect(row?.setup_fee_paid).toBe(false);
    expect(row?.plan_slug).toBe('growth');
    const trialEnd = new Date(String(row?.trial_end)).getTime();
    const expected = Date.now() + 14 * 86400_000;
    expect(Math.abs(trialEnd - expected)).toBeLessThan(60_000);
    // Compat mirror updated after the canonical write.
    expect(state.accounts[0].subscription_status).toBe('TRIALING');
  });

  it('period-end cancellation stays ACTIVE with cancel_at_period_end=true', async () => {
    state.subscriptions.push({
      id: 'sub-1',
      account_id: 'acc-1',
      status: 'ACTIVE',
      cancel_at_period_end: false,
    });

    await cancelSubscription({ workspaceId: 'acc-1' });

    const row = subRow('acc-1');
    expect(row?.status).toBe('ACTIVE');
    expect(row?.cancel_at_period_end).toBe(true);
    expect(row?.cancelled_at).toBeTruthy();
  });

  it('immediate cancellation becomes CANCELLED with cancel_at_period_end=false', async () => {
    state.subscriptions.push({
      id: 'sub-1',
      account_id: 'acc-1',
      status: 'ACTIVE',
    });

    await cancelSubscription({ workspaceId: 'acc-1', cancelImmediately: true });

    const row = subRow('acc-1');
    expect(row?.status).toBe('CANCELLED');
    expect(row?.cancel_at_period_end).toBe(false);
  });

  it('reactivation restores ACTIVE and clears cancellation flags', async () => {
    state.subscriptions.push({
      id: 'sub-1',
      account_id: 'acc-1',
      status: 'ACTIVE',
      cancel_at_period_end: true,
      cancelled_at: new Date().toISOString(),
    });

    await reactivateSubscription('acc-1');

    const row = subRow('acc-1');
    expect(row?.status).toBe('ACTIVE');
    expect(row?.cancel_at_period_end).toBe(false);
    expect(row?.cancelled_at).toBeNull();
  });

  it('payment failure marks PAST_DUE with a grace period end', async () => {
    state.subscriptions.push({
      id: 'sub-1',
      account_id: 'acc-1',
      status: 'ACTIVE',
    });

    await handlePaymentFailure('acc-1', 3);

    const row = subRow('acc-1');
    expect(row?.status).toBe('PAST_DUE');
    const grace = new Date(String(row?.grace_period_end)).getTime();
    expect(Math.abs(grace - (Date.now() + 3 * 86400_000))).toBeLessThan(60_000);
    expect(state.accounts[0].subscription_status).toBe('PAST_DUE');
  });

  it('upgradeSubscription extends the period by one calendar interval', async () => {
    const sub = await upgradeSubscription({
      workspaceId: 'acc-1',
      newPlanId: 'plan_growth',
      billingCycle: 'monthly',
    });
    expect(sub.status).toBe('ACTIVE');
    const start = new Date(sub.currentPeriodStart);
    const end = new Date(sub.currentPeriodEnd);
    expect(end.getTime()).toBeGreaterThan(start.getTime());
    // Calendar month, not a fixed 30 days.
    expect(end.getUTCMonth()).toBe((start.getUTCMonth() + 1) % 12);
  });

  it('grace expiry transitions PAST_DUE to EXPIRED via the cron sweeper', async () => {
    state.subscriptions.push({
      id: 'sub-1',
      account_id: 'acc-1',
      status: 'PAST_DUE',
      grace_period_end: new Date(Date.now() - 86400_000).toISOString(),
    });

    const result = await expireStaleTrials();

    expect(result.expiredSubsCount).toBe(1);
    expect(subRow('acc-1')?.status).toBe('EXPIRED');
  });

  it('trial expiry transitions TRIALING to TRIAL_EXPIRED', async () => {
    state.subscriptions.push({
      id: 'sub-1',
      account_id: 'acc-1',
      status: 'TRIALING',
      trial_end: new Date(Date.now() - 86400_000).toISOString(),
    });

    const result = await expireStaleTrials();

    expect(result.expiredTrialsCount).toBe(1);
    expect(subRow('acc-1')?.status).toBe('TRIAL_EXPIRED');
  });
});
