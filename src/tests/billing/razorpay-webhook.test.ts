import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';
import { POST } from '@/app/api/webhooks/razorpay/route';

const WEBHOOK_SECRET = 'test-webhook-secret';
const ORIGINAL_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;

const state = vi.hoisted(() => ({
  orderRow: null as Record<string, unknown> | null,
  orderLookupError: null as { message: string } | null,
  subscriptionRow: null as Record<string, unknown> | null,
  rpcCalls: [] as Array<{ fn: string; args: Record<string, unknown> }>,
  rpcResult: {
    status: 'processed',
    period_end: '2026-10-01T00:00:00Z',
  } as Record<string, unknown> | null,
  rpcError: null as { message: string } | null,
  auditInserts: [] as Array<Record<string, unknown>>,
}));

vi.mock('@/lib/supabase/server', () => ({
  getAdminClient: () => ({
    from: (table: string) => {
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => {
          if (table === 'billing_orders') {
            return { data: state.orderRow, error: state.orderLookupError };
          }
          if (table === 'subscriptions') {
            return { data: state.subscriptionRow, error: null };
          }
          return { data: null, error: null };
        },
        insert: async (payload: Record<string, unknown>) => {
          if (table === 'audit_logs') state.auditInserts.push(payload);
          return { data: null, error: null };
        },
      };
      return chain;
    },
    rpc: async (fn: string, args: Record<string, unknown>) => {
      state.rpcCalls.push({ fn, args });
      if (state.rpcError) return { data: null, error: state.rpcError };
      return { data: state.rpcResult, error: null };
    },
  }),
}));

// Keep the plan catalog on DEFAULT_PLANS (db-backed catalog unavailable).
vi.mock('@/lib/db/server', () => ({
  getAdminClient: () => ({
    from: () => ({
      select: () => ({
        order: async () => ({ data: null, error: { message: 'no db' } }),
      }),
    }),
  }),
}));

const ACCOUNT_ID = '11111111-2222-3333-4444-555555555555';

const GROWTH_ORDER_ROW = {
  account_id: ACCOUNT_ID,
  plan_slug: 'growth',
  billing_interval: 'monthly',
  amount_paise: 1_699_800,
  currency: 'INR',
  setup_fee_included: true,
  setup_fee_amount: 11999,
  monthly_amount: 4999,
};

function signedRequest(payload: Record<string, unknown>): Request {
  const body = JSON.stringify(payload);
  const signature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(body)
    .digest('hex');
  return new Request('http://localhost/api/webhooks/razorpay', {
    method: 'POST',
    headers: { 'x-razorpay-signature': signature },
    body,
  });
}

function capturedEvent(
  overrides: Partial<{
    amount: number;
    currency: string;
    paymentId: string | undefined;
    orderId: string | undefined;
  }> = {}
): Record<string, unknown> {
  return {
    event: 'payment.captured',
    payload: {
      payment: {
        entity: {
          id: 'paymentId' in overrides ? overrides.paymentId : 'pay_live_1',
          order_id: 'orderId' in overrides ? overrides.orderId : 'order_live_1',
          amount: overrides.amount ?? 1_699_800,
          currency: overrides.currency ?? 'INR',
          status: 'captured',
        },
      },
    },
  };
}

beforeEach(() => {
  process.env.RAZORPAY_WEBHOOK_SECRET = WEBHOOK_SECRET;
  state.orderRow = { ...GROWTH_ORDER_ROW };
  state.orderLookupError = null;
  state.subscriptionRow = null;
  state.rpcCalls.length = 0;
  state.rpcResult = { status: 'processed', period_end: '2026-10-01T00:00:00Z' };
  state.rpcError = null;
  state.auditInserts.length = 0;
});

afterEach(() => {
  if (ORIGINAL_SECRET === undefined) delete process.env.RAZORPAY_WEBHOOK_SECRET;
  else process.env.RAZORPAY_WEBHOOK_SECRET = ORIGINAL_SECRET;
});

describe('POST /api/webhooks/razorpay — captured payments', () => {
  it('activates the subscription via the atomic RPC with server-side values', async () => {
    const res = await POST(signedRequest(capturedEvent()) as never);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.status).toBe('subscription_activated');
    expect(state.rpcCalls).toHaveLength(1);
    expect(state.rpcCalls[0].fn).toBe('billing_apply_payment_captured');
    expect(state.rpcCalls[0].args).toMatchObject({
      p_account_id: ACCOUNT_ID,
      p_payment_id: 'pay_live_1',
      p_order_id: 'order_live_1',
      p_plan_slug: 'growth',
      p_amount_paise: 1_699_800,
      p_setup_fee_included: true,
    });
  });

  it('acknowledges duplicate deliveries without extending the period again', async () => {
    state.rpcResult = { status: 'already_processed' };
    const res = await POST(signedRequest(capturedEvent()) as never);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.status).toBe('already_processed');
  });

  it('does not activate on amount mismatch', async () => {
    const res = await POST(
      signedRequest(capturedEvent({ amount: 499_900 })) as never
    );
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.status).toBe('amount_mismatch_not_activated');
    expect(state.rpcCalls).toHaveLength(0);
    expect(state.auditInserts).toHaveLength(1);
    expect(state.auditInserts[0].action).toBe(
      'billing.payment_amount_mismatch'
    );
  });

  it('does not activate on currency mismatch', async () => {
    const res = await POST(
      signedRequest(capturedEvent({ currency: 'USD' })) as never
    );
    const json = await res.json();
    expect(json.status).toBe('amount_mismatch_not_activated');
    expect(state.rpcCalls).toHaveLength(0);
  });

  it('returns a retryable 500 when the database write fails', async () => {
    state.rpcError = { message: 'deadlock detected' };
    const res = await POST(signedRequest(capturedEvent()) as never);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).not.toMatch(/deadlock/);
  });

  it('safely ignores events without a payment id (no synthetic ids)', async () => {
    const res = await POST(
      signedRequest(capturedEvent({ paymentId: undefined })) as never
    );
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.status).toBe('ignored_missing_identity');
    expect(state.rpcCalls).toHaveLength(0);
  });

  it('ignores unresolvable legacy events without server-created metadata', async () => {
    state.orderRow = null;
    const res = await POST(signedRequest(capturedEvent()) as never);
    const json = await res.json();
    expect(json.status).toBe('ignored_unresolvable_order');
    expect(state.rpcCalls).toHaveLength(0);
  });

  it('recomputes the price from persisted state for legacy note-based orders', async () => {
    state.orderRow = null;
    state.subscriptionRow = { setup_fee_paid: true };
    const payload = capturedEvent({ amount: 499_900 });
    (
      payload.payload as {
        payment: { entity: Record<string, unknown> };
      }
    ).payment.entity.notes = {
      account_id: ACCOUNT_ID,
      plan_slug: 'growth',
      // A tampered/incorrect note must not change the server-side price.
      isFirstTime: 'true',
    };

    const res = await POST(signedRequest(payload) as never);
    const json = await res.json();
    expect(json.status).toBe('subscription_activated');
    expect(state.rpcCalls[0].args).toMatchObject({
      p_amount_paise: 499_900,
      p_setup_fee_included: false,
    });
  });
});

describe('POST /api/webhooks/razorpay — failed payments', () => {
  it('marks the subscription PAST_DUE through the atomic RPC', async () => {
    const res = await POST(
      signedRequest({
        event: 'payment.failed',
        payload: {
          payment: {
            entity: {
              id: 'pay_failed_1',
              order_id: 'order_live_1',
              amount: 499_900,
              currency: 'INR',
              error_code: 'BAD_CARD',
              error_description: 'Card declined',
            },
          },
        },
      }) as never
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.status).toBe('subscription_marked_past_due');
    expect(state.rpcCalls).toHaveLength(1);
    expect(state.rpcCalls[0].fn).toBe('billing_apply_payment_failed');
    expect(state.rpcCalls[0].args).toMatchObject({
      p_account_id: ACCOUNT_ID,
      p_payment_id: 'pay_failed_1',
      p_error_code: 'BAD_CARD',
    });
  });

  it('returns 500 when the failure write cannot be committed', async () => {
    state.rpcError = { message: 'io error' };
    const res = await POST(
      signedRequest({
        event: 'payment.failed',
        payload: {
          payment: {
            entity: { id: 'pay_failed_2', order_id: 'order_live_1' },
          },
        },
      }) as never
    );
    expect(res.status).toBe(500);
  });
});

describe('POST /api/webhooks/razorpay — event filtering', () => {
  it('acknowledges unhandled event types without processing', async () => {
    const res = await POST(
      signedRequest({ event: 'refund.processed', payload: {} }) as never
    );
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.received).toBe(true);
    expect(state.rpcCalls).toHaveLength(0);
  });
});
