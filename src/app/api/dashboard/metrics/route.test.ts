import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requireRole, mockSupabaseFrom } = vi.hoisted(() => ({
  requireRole: vi.fn(),
  mockSupabaseFrom: vi.fn(),
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
  getAdminClient: () => ({
    from: mockSupabaseFrom,
  }),
}));

import { POST } from './route';

type QueryResult = {
  data?: unknown;
  count?: number;
  error?: null;
};

function createQuery(resolve: () => QueryResult) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    neq: vi.fn(),
    gt: vi.fn(),
    lt: vi.fn(),
    gte: vi.fn(),
    lte: vi.fn(),
    then(
      onFulfilled?: (value: QueryResult) => unknown,
      onRejected?: (reason: unknown) => unknown
    ) {
      return Promise.resolve(resolve()).then(onFulfilled, onRejected);
    },
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.neq.mockReturnValue(query);
  query.gt.mockReturnValue(query);
  query.lt.mockReturnValue(query);
  query.gte.mockReturnValue(query);
  query.lte.mockReturnValue(query);
  return query;
}

describe('POST /api/dashboard/metrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireRole.mockResolvedValue({
      accountId: 'acc-clinic',
      userId: 'user-1',
      role: 'viewer',
      account: { industry: 'hospital_clinic' },
    });

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'leads') {
        return createQuery(() => ({
          data: [
            { id: 'l1', stage: 'NEW', value: 0, source: 'whatsapp' },
            { id: 'l2', stage: 'CONTACTED', value: 0, source: 'whatsapp' },
            { id: 'l3', stage: 'CONVERTED', value: 0, source: 'facebook' },
            { id: 'l4', stage: 'NEW', value: 0, source: 'import' },
          ],
          error: null,
        }));
      }

      if (table === 'deals') {
        return createQuery(() => ({ data: [], error: null }));
      }

      if (table === 'invoices') {
        return createQuery(() => ({ data: [], error: null }));
      }

      if (table === 'messages') {
        const state = { direction: '' };
        const query = createQuery(() => ({
          data: [],
          count: state.direction === 'outbound' ? 12 : 7,
          error: null,
        }));
        query.eq.mockImplementation((field: string, value: unknown) => {
          if (field === 'direction') state.direction = String(value);
          return query;
        });
        return query;
      }

      return createQuery(() => ({ data: [], count: 0, error: null }));
    });
  });

  it('counts outbound/inbound messages and returns lead source percentages', async () => {
    const req = new Request('http://localhost/api/dashboard/metrics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ industry: 'hospital_clinic', range: 'all_time' }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.metrics.messages_sent).toBe(12);
    expect(json.metrics.messages_received).toBe(7);
    expect(json.metrics.leads_total).toBe(4);
    expect(json.lead_sources).toEqual([
      { key: 'whatsapp', label: 'WhatsApp', count: 2, percent: 50 },
      { key: 'facebook', label: 'Facebook', count: 1, percent: 25 },
      { key: 'import', label: 'Import', count: 1, percent: 25 },
    ]);
    expect(mockSupabaseFrom).toHaveBeenCalledWith('messages');
    expect(mockSupabaseFrom).toHaveBeenCalledWith('leads');
  });
});
