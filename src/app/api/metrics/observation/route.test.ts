import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requireRole, mockFrom } = vi.hoisted(() => ({
  requireRole: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock('@/lib/auth/account', () => ({
  requireRole,
  toErrorResponse: (err: { status?: number; message?: string }) =>
    new Response(JSON.stringify({ error: err.message || 'Unauthorized' }), {
      status: err.status || 401,
      headers: { 'Content-Type': 'application/json' },
    }),
}));

vi.mock('@/lib/supabase/server', () => ({
  getAdminClient: () => ({ from: mockFrom }),
}));

import { GET } from './route';

function createQuery(rows: unknown[]) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    then(
      onFulfilled?: (value: { data: unknown; error: null }) => unknown,
      onRejected?: (reason: unknown) => unknown
    ) {
      return Promise.resolve({ data: rows, error: null }).then(
        onFulfilled,
        onRejected
      );
    },
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.limit.mockReturnValue(query);
  return query;
}

describe('GET /api/metrics/observation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireRole.mockResolvedValue({
      accountId: 'acc-clinic',
      userId: 'user-1',
      role: 'viewer',
      account: { name: 'Clinic' },
    });
  });

  it('scopes events to the session account and never returns raw rows', async () => {
    mockFrom.mockImplementation((table: string) => {
      expect(table).toBe('product_outcome_events');
      return createQuery([
        {
          account_id: 'acc-clinic',
          event_name: 'inbound_message_received',
          event_version: 1,
          occurred_at: '2026-09-01T00:00:00.000Z',
          source_id: 'inbound:acc-clinic:aaaaaaaaaaaaaaaa',
          subject_hash: null,
          is_synthetic: false,
          is_test_tenant: false,
          attributes: { channel: 'whatsapp' },
        },
        {
          account_id: 'acc-other',
          event_name: 'inbound_message_received',
          event_version: 1,
          occurred_at: '2026-09-01T00:00:00.000Z',
          source_id: 'inbound:acc-other:bbbbbbbbbbbbbbbb',
          subject_hash: null,
          is_synthetic: false,
          is_test_tenant: false,
          attributes: { channel: 'whatsapp' },
        },
      ]);
    });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.accountId).toBe('acc-clinic');
    expect(body.events.eligible).toBe(1);
    expect(body.publication.allowed).toBe(false);
    expect(body.slo.targets.medianFirstResponseSeconds).toBe(60);
    expect(body.slo.observed.readyHttpSuccess).toBeNull();
    expect(body.slo.note).toMatch(/not achieved/i);
    expect(body.readiness.isProductionObservationComplete).toBe(false);
    expect(body).not.toHaveProperty('rows');
    expect(JSON.stringify(body)).not.toMatch(/acc-other/);
    expect(JSON.stringify(body)).not.toMatch(/\+91|phone_number|patient_name/i);
  });

  it('rejects unauthenticated callers', async () => {
    requireRole.mockRejectedValue({ status: 401, message: 'Unauthorized' });
    const res = await GET();
    expect(res.status).toBe(401);
  });
});
