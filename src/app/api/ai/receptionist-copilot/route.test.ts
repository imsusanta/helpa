import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requireRole, mockFrom } = vi.hoisted(() => ({
  requireRole: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock('@/lib/auth/account', () => ({
  requireRole,
  toErrorResponse: (err: { status?: number; message?: string }) =>
    new Response(
      JSON.stringify({
        error: err.status
          ? err.message || 'Unauthorized'
          : 'Internal server error',
      }),
      {
        status: err.status || 500,
        headers: { 'Content-Type': 'application/json' },
      }
    ),
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({
    success: true,
    remaining: 10,
    reset: Date.now() + 1000,
    limit: 20,
  }),
  rateLimitResponse: vi.fn(),
  RATE_LIMITS: {
    adminAction: { limit: 20, windowMs: 10_000 },
  },
}));

vi.mock('@/core/ai/resolver', () => ({
  resolveAccountAiConfig: vi.fn(async () => ({
    primary: { apiKey: undefined, model: undefined },
    fallback: undefined,
  })),
}));

vi.mock('@/lib/saas/subscription', () => ({
  checkPlanLimits: vi.fn(),
  incrementUsage: vi.fn(),
}));

import { POST } from './route';

const MISSING_COMPANY_COLUMN = {
  code: '42703',
  message: 'column contacts_1.company does not exist',
};

function selectAsksForCompanyColumn(select: string): boolean {
  return /contact:contacts\([^)]*\bcompany\b/.test(select);
}

function createQuery(result: { data: unknown; error: unknown }) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    maybeSingle: vi.fn(),
    then(
      onFulfilled?: (value: { data: unknown; error: unknown }) => unknown,
      onRejected?: (reason: unknown) => unknown
    ) {
      const data = Array.isArray(result.data)
        ? result.data
        : result.data
          ? [result.data]
          : [];
      return Promise.resolve({ data, error: result.error }).then(
        onFulfilled,
        onRejected
      );
    },
  };
  query.select.mockImplementation((columns: string) => {
    if (
      selectAsksForCompanyColumn(columns) ||
      columns === 'id, name, phone, email, company'
    ) {
      const failed = {
        ...query,
        then(
          onFulfilled?: (value: { data: unknown; error: unknown }) => unknown,
          onRejected?: (reason: unknown) => unknown
        ) {
          return Promise.resolve({
            data: null,
            error: MISSING_COMPANY_COLUMN,
          }).then(onFulfilled, onRejected);
        },
        maybeSingle: vi.fn(async () => ({
          data: null,
          error: MISSING_COMPANY_COLUMN,
        })),
      };
      failed.select.mockReturnValue(failed);
      failed.eq.mockReturnValue(failed);
      failed.order.mockReturnValue(failed);
      failed.limit.mockReturnValue(failed);
      return failed;
    }
    return query;
  });
  query.eq.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.limit.mockReturnValue(query);
  query.maybeSingle.mockImplementation(async () => {
    const data = Array.isArray(result.data) ? result.data[0] : result.data;
    return { data, error: result.error };
  });
  return query;
}

describe('POST /api/ai/receptionist-copilot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireRole.mockResolvedValue({
      accountId: 'acc-1',
      userId: 'user-1',
      role: 'viewer',
      account: { name: 'Clinic' },
      appwrite: { from: mockFrom },
    });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'conversations') {
        return createQuery({
          data: {
            id: 'conv-1',
            account_id: 'acc-1',
            contact_id: 'contact-1',
            status: 'open',
            last_message_text: 'Hi',
            last_message_at: '2026-09-02T15:00:00.000Z',
            ai_summary: null,
            created_at: '2026-09-02T15:00:00.000Z',
            contact: {
              id: 'contact-1',
              name: 'Susanta Lohar',
              phone: '+918927093059',
              email: null,
              metadata: {},
            },
          },
          error: null,
        });
      }
      if (table === 'accounts') {
        return createQuery({
          data: { name: 'Clinic', industry: 'hospital_clinic' },
          error: null,
        });
      }
      return createQuery({ data: [], error: null });
    });
  });

  it('loads the conversation without selecting contacts.company', async () => {
    const res = await POST(
      new Request('http://localhost/api/ai/receptionist-copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: 'conv-1' }),
      })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.error).toBeUndefined();
    expect(body.snapshot).toBeTruthy();
    expect(JSON.stringify(body)).not.toMatch(/Failed to load conversation/);
  });

  it('requires a conversationId', async () => {
    const res = await POST(
      new Request('http://localhost/api/ai/receptionist-copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
    );
    expect(res.status).toBe(400);
  });
});
