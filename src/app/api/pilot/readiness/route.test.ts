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

function accountQuery() {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            id: 'acc-clinic',
            name: 'CityCare Demo Clinic',
            industry: 'hospital_clinic',
            status: 'active',
          },
          error: null,
        }),
      }),
    }),
  };
}

function whatsappQuery() {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            provider: 'evolution',
            status: 'connected',
            connection_status: 'connected',
            last_health_check_at: '2026-09-01T00:00:00.000Z',
            last_webhook_at: '2026-09-01T00:00:00.000Z',
            phone_number_id: 'pnid-1',
          },
          error: null,
        }),
      }),
    }),
  };
}

function countQuery(count: number) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    then(
      onFulfilled?: (value: { count: number; error: null }) => unknown,
      onRejected?: (reason: unknown) => unknown
    ) {
      return Promise.resolve({ count, error: null }).then(
        onFulfilled,
        onRejected
      );
    },
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  return query;
}

describe('GET /api/pilot/readiness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireRole.mockResolvedValue({
      accountId: 'acc-clinic',
      userId: 'user-1',
      role: 'admin',
      account: { name: 'CityCare Demo Clinic' },
    });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'accounts') return accountQuery();
      if (table === 'whatsapp_configs') return whatsappQuery();
      return countQuery(1);
    });
  });

  it('returns clinic, environment, and integration flags without patient data', async () => {
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.clinic.accountId).toBe('acc-clinic');
    expect(body.clinic.name).toBe('CityCare Demo Clinic');
    expect(body.integration.whatsapp.connected).toBe(true);
    expect(body.integration.whatsapp).not.toHaveProperty('phone_number_id');
    expect(JSON.stringify(body)).not.toMatch(/encrypted|token|secret|\+91/i);
  });

  it('requires admin role', async () => {
    requireRole.mockRejectedValue({
      status: 403,
      message: "This action requires the 'admin' role or higher",
    });
    const res = await GET();
    expect(res.status).toBe(403);
  });
});
