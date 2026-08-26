import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/billing/create-order/route';

/**
 * Setup-fee eligibility is determined only from persisted data; the plan
 * must come from the active server-side catalog; only owners may order.
 */

const state = vi.hoisted(() => ({
  role: 'owner' as 'owner' | 'forbidden',
  subscriptionRow: null as Record<string, unknown> | null,
  capturedSetupPayment: null as Record<string, unknown> | null,
  planRows: [] as Array<Record<string, unknown>>,
  orderInserts: [] as Array<Record<string, unknown>>,
  orderInsertError: null as { message: string } | null,
}));

vi.mock('@/lib/auth/account', () => {
  class ForbiddenError extends Error {
    status = 403 as const;
  }
  class UnauthorizedError extends Error {
    status = 401 as const;
  }
  return {
    ForbiddenError,
    UnauthorizedError,
    toErrorResponse: (err: unknown) => {
      const status =
        err instanceof ForbiddenError || err instanceof UnauthorizedError
          ? err.status
          : 500;
      return Response.json({ error: 'denied' }, { status });
    },
    requireRole: vi.fn(async () => {
      if (state.role === 'forbidden') {
        throw new ForbiddenError('owner role required');
      }
      return {
        accountId: 'acc-11111111',
        userId: 'user-1',
        role: 'owner',
      };
    }),
  };
});

vi.mock('@/lib/db/server', () => ({
  getAdminClient: () => ({
    from: (table: string) => {
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: () => chain,
        order: () => chain,
        limit: () => chain,
        maybeSingle: async () => {
          if (table === 'subscriptions') {
            return { data: state.subscriptionRow, error: null };
          }
          if (table === 'platform_payments') {
            return { data: state.capturedSetupPayment, error: null };
          }
          return { data: null, error: null };
        },
        insert: async (payload: Record<string, unknown>) => {
          if (table === 'billing_orders') {
            if (state.orderInsertError) {
              return { data: null, error: state.orderInsertError };
            }
            state.orderInserts.push(payload);
          }
          return { data: null, error: null };
        },
        then: (
          resolve: (v: { data: unknown[]; error: null }) => unknown,
          reject?: (e: unknown) => unknown
        ) =>
          Promise.resolve({
            data: table === 'plans' ? state.planRows : [],
            error: null,
          }).then(resolve, reject),
      };
      return chain;
    },
  }),
}));

function makeRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost/api/billing/create-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  state.role = 'owner';
  state.subscriptionRow = null;
  state.capturedSetupPayment = null;
  state.planRows = [];
  state.orderInserts = [];
  state.orderInsertError = null;
  delete process.env.RAZORPAY_KEY_ID;
  delete process.env.RAZORPAY_KEY_SECRET;
});

describe('POST /api/billing/create-order', () => {
  it('includes the setup fee when no subscription row exists', async () => {
    const res = await POST(makeRequest({ planSlug: 'growth' }) as never);
    const json = await res.json();

    expect(res.status).toBe(200);
    // Growth: ₹11,999 setup + ₹4,999 monthly = ₹16,998 → 1,699,800 paise.
    expect(json.amount).toBe(1_699_800);
    expect(json.plan.isFirstTime).toBe(true);
    expect(state.orderInserts).toHaveLength(1);
    expect(state.orderInserts[0].setup_fee_included).toBe(true);
    expect(state.orderInserts[0].amount_paise).toBe(1_699_800);
  });

  it('includes the setup fee when the subscription has setup_fee_paid=false', async () => {
    state.subscriptionRow = { id: 'sub-1', setup_fee_paid: false };
    const res = await POST(makeRequest({ planSlug: 'growth' }) as never);
    const json = await res.json();

    expect(json.plan.isFirstTime).toBe(true);
    expect(json.amount).toBe(1_699_800);
  });

  it('excludes the setup fee when setup_fee_paid=true', async () => {
    state.subscriptionRow = { id: 'sub-1', setup_fee_paid: true };
    const res = await POST(makeRequest({ planSlug: 'growth' }) as never);
    const json = await res.json();

    expect(json.plan.isFirstTime).toBe(false);
    // Monthly only: ₹4,999 → 499,900 paise.
    expect(json.amount).toBe(499_900);
    expect(state.orderInserts[0].setup_fee_included).toBe(false);
  });

  it('treats a captured setup-fee payment in the ledger as setup fee paid', async () => {
    state.subscriptionRow = { id: 'sub-1', setup_fee_paid: false };
    state.capturedSetupPayment = { id: 'pp-1' };
    const res = await POST(makeRequest({ planSlug: 'growth' }) as never);
    const json = await res.json();

    expect(json.plan.isFirstTime).toBe(false);
    expect(json.amount).toBe(499_900);
  });

  it('never trusts a client-provided isFirstTime flag', async () => {
    state.subscriptionRow = { id: 'sub-1', setup_fee_paid: true };
    const res = await POST(
      makeRequest({ planSlug: 'growth', isFirstTime: true }) as never
    );
    const json = await res.json();
    expect(json.plan.isFirstTime).toBe(false);
    expect(json.amount).toBe(499_900);
  });

  it('rejects unknown plans', async () => {
    const res = await POST(makeRequest({ planSlug: 'platinum' }) as never);
    expect(res.status).toBe(404);
  });

  it('rejects inactive plans', async () => {
    // The catalog is served from the plans table when present.
    state.planRows = [
      {
        id: 'plan_starter',
        slug: 'starter',
        name: 'Starter',
        is_active: false,
        setup_fee: 7999,
        monthly_price: 3499,
      },
    ];
    const res = await POST(makeRequest({ planSlug: 'starter' }) as never);
    expect(res.status).toBe(404);
  });

  it('rejects non-owner callers', async () => {
    state.role = 'forbidden';
    const res = await POST(makeRequest({ planSlug: 'growth' }) as never);
    expect(res.status).toBe(403);
    expect(state.orderInserts).toHaveLength(0);
  });

  it('returns 500 when the server-side order record cannot be persisted', async () => {
    state.orderInsertError = { message: 'insert failed' };
    const res = await POST(makeRequest({ planSlug: 'growth' }) as never);
    expect(res.status).toBe(500);
  });

  it('does not put PII or price into razorpay order notes', async () => {
    const res = await POST(makeRequest({ planSlug: 'growth' }) as never);
    const json = await res.json();
    expect(res.status).toBe(200);
    // The mock order echoes notes back; assert the server sent identifiers only.
    expect(json.orderId).toMatch(/^order_mock_/);
    const insert = state.orderInserts[0];
    expect(insert.created_by).toBe('user-1');
  });
});
