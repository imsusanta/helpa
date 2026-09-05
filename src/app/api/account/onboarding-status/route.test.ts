import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET as handleOnboardingStatus } from './route';

const mockFrom = vi.fn();
const mockAdminClient = {
  from: mockFrom,
};

vi.mock('@/lib/supabase/server', () => ({
  getAdminClient: () => mockAdminClient,
}));

let mockUserRole: string = 'owner';
let mockAccountId: string = 'acc-123';

vi.mock('@/lib/auth/account', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/auth/account')>(
      '@/lib/auth/account'
    );
  return {
    ...actual,
    requireRole: vi.fn(async (minRole: string) => {
      if (mockUserRole === 'unauthenticated') {
        throw new actual.UnauthorizedError('Unauthorized');
      }
      if (minRole === 'owner' && mockUserRole !== 'owner') {
        throw new actual.ForbiddenError('Owner role required');
      }
      return {
        userId: 'user-123',
        accountId: mockAccountId,
        role: mockUserRole,
      };
    }),
  };
});

describe('GET /api/account/onboarding-status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserRole = 'owner';
    mockAccountId = 'acc-123';
  });

  it('returns needs_onboarding: true when neither completed nor exempted for eligible owner', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              onboarding_completed_at: null,
              onboarding_exempted_at: null,
              welcome_message: null,
            },
            error: null,
          }),
        }),
      }),
    });

    const res = await handleOnboardingStatus();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.needs_onboarding).toBe(true);
    expect(body.completed_at).toBeNull();
    expect(body.exempted_at).toBeNull();
  });

  it('returns needs_onboarding: false when onboarding_completed_at is already set', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              onboarding_completed_at: '2026-09-05T10:00:00Z',
              onboarding_exempted_at: null,
              welcome_message: 'Namaste! Welcome to our clinic.',
            },
            error: null,
          }),
        }),
      }),
    });

    const res = await handleOnboardingStatus();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.needs_onboarding).toBe(false);
    expect(body.completed_at).toBe('2026-09-05T10:00:00Z');
  });

  it('returns needs_onboarding: false when onboarding_exempted_at is set (legacy account)', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              onboarding_completed_at: null,
              onboarding_exempted_at: '2026-09-05T00:00:00Z',
              welcome_message: null,
            },
            error: null,
          }),
        }),
      }),
    });

    const res = await handleOnboardingStatus();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.needs_onboarding).toBe(false);
    expect(body.exempted_at).toBe('2026-09-05T00:00:00Z');
  });

  it('returns 403 Forbidden for invited staff (agent role)', async () => {
    mockUserRole = 'agent';

    const res = await handleOnboardingStatus();
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain('Owner role required');
  });

  it('returns 403 Forbidden for invited admin (not workspace owner)', async () => {
    mockUserRole = 'admin';

    const res = await handleOnboardingStatus();
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain('Owner role required');
  });

  it('returns 401 Unauthorized for unauthenticated requests', async () => {
    mockUserRole = 'unauthenticated';

    const res = await handleOnboardingStatus();
    expect(res.status).toBe(401);
  });

  it('fails open (needs_onboarding: false) when database error occurs so dashboard is not blocked', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'DB connection timeout' },
          }),
        }),
      }),
    });

    const res = await handleOnboardingStatus();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.needs_onboarding).toBe(false);
  });
});
