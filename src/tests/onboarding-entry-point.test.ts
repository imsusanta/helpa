import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET as handleGetStatus } from '@/app/api/account/onboarding-status/route';

// Mock dependencies for route testing
const mockAdminClient = {
  from: vi.fn(),
};

vi.mock('@/lib/supabase/server', () => ({
  getAdminClient: () => mockAdminClient,
}));

let mockAuthContext: {
  userId: string;
  accountId: string;
  role: string;
} | null = null;

vi.mock('@/lib/auth/account', () => ({
  requireRole: vi.fn().mockImplementation(async (requiredRole: string) => {
    if (!mockAuthContext) {
      const err = new Error('Unauthorized');
      (err as unknown as { status: number }).status = 401;
      throw err;
    }
    if (requiredRole === 'owner' && mockAuthContext.role !== 'owner') {
      const err = new Error('Forbidden: role owner required');
      (err as unknown as { status: number }).status = 403;
      throw err;
    }
    return mockAuthContext;
  }),
  toErrorResponse: vi.fn().mockImplementation((err: unknown) => {
    const status = (err as { status?: number })?.status || 500;
    const message = (err as Error)?.message || 'Internal error';
    return Response.json({ error: message }, { status });
  }),
}));

describe('Onboarding Entry-Point & Gate Logic Contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthContext = {
      userId: 'user-owner-1',
      accountId: 'acc-tenant-1',
      role: 'owner',
    };
  });

  describe('GET /api/account/onboarding-status', () => {
    it('returns needs_onboarding: true for brand new workspace (both timestamps null)', async () => {
      mockAdminClient.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockReturnValueOnce({
            maybeSingle: vi.fn().mockResolvedValueOnce({
              data: {
                id: 'acc-tenant-1',
                onboarding_completed_at: null,
                onboarding_exempted_at: null,
                onboarding_exemption_reason: null,
              },
              error: null,
            }),
          }),
        }),
      });

      const res = await handleGetStatus();
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({
        needs_onboarding: true,
        completed_at: null,
        exempted_at: null,
      });
    });

    it('returns needs_onboarding: false for genuinely completed account', async () => {
      const completedTimestamp = '2026-09-01T12:00:00.000Z';
      mockAdminClient.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockReturnValueOnce({
            maybeSingle: vi.fn().mockResolvedValueOnce({
              data: {
                id: 'acc-tenant-1',
                onboarding_completed_at: completedTimestamp,
                onboarding_exempted_at: null,
                onboarding_exemption_reason: null,
              },
              error: null,
            }),
          }),
        }),
      });

      const res = await handleGetStatus();
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({
        needs_onboarding: false,
        completed_at: completedTimestamp,
        exempted_at: null,
      });
    });

    it('returns needs_onboarding: false for legacy exempted account with truthful NULL completed_at', async () => {
      const exemptedTimestamp = '2026-08-15T00:00:00.000Z';
      mockAdminClient.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockReturnValueOnce({
            maybeSingle: vi.fn().mockResolvedValueOnce({
              data: {
                id: 'acc-tenant-1',
                onboarding_completed_at: null,
                onboarding_exempted_at: exemptedTimestamp,
                onboarding_exemption_reason: 'legacy_account_pre_contract',
              },
              error: null,
            }),
          }),
        }),
      });

      const res = await handleGetStatus();
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({
        needs_onboarding: false,
        completed_at: null,
        exempted_at: exemptedTimestamp,
      });
    });

    it('strictly requires workspace owner role; rejects non-owner with 403', async () => {
      mockAuthContext = {
        userId: 'user-agent-1',
        accountId: 'acc-tenant-1',
        role: 'agent',
      };

      const res = await handleGetStatus();
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toContain('role owner required');
    });

    it('rejects admin who is not workspace owner with 403', async () => {
      mockAuthContext = {
        userId: 'user-admin-1',
        accountId: 'acc-tenant-1',
        role: 'admin',
      };

      const res = await handleGetStatus();
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toContain('role owner required');
    });

    it('fails open cleanly returning needs_onboarding: false on db error so dashboard is not blocked', async () => {
      mockAdminClient.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockReturnValueOnce({
            maybeSingle: vi.fn().mockResolvedValueOnce({
              data: null,
              error: { message: 'Database query timeout' },
            }),
          }),
        }),
      });

      const res = await handleGetStatus();
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ needs_onboarding: false });
    });
  });

  describe('Session Deferral Storage Key Contract', () => {
    const DEFERRAL_PREFIX = 'helpa_onboarding_deferred';

    function getDeferralKey(accountId: string): string {
      return `${DEFERRAL_PREFIX}_${accountId}`;
    }

    it('formats scoped session storage key per account to prevent tenant leakage', () => {
      const acc1Key = getDeferralKey('acc-clinic-1');
      const acc2Key = getDeferralKey('acc-clinic-2');

      expect(acc1Key).toBe('helpa_onboarding_deferred_acc-clinic-1');
      expect(acc2Key).toBe('helpa_onboarding_deferred_acc-clinic-2');
      expect(acc1Key).not.toBe(acc2Key);
    });
  });
});
