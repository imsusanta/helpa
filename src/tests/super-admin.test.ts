import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  profileMaybeSingle: vi.fn(),
  getCurrentAccount: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mocks.getUser },
  })),
  getAdminClient: vi.fn(() => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: mocks.profileMaybeSingle }),
      }),
    }),
  })),
}));

vi.mock('@/lib/appwrite-server-compat', () => ({
  getAdminClient: vi.fn(() => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: mocks.profileMaybeSingle }),
      }),
    }),
  })),
}));

vi.mock('@/lib/auth/account', () => ({
  getCurrentAccount: mocks.getCurrentAccount,
}));

import { checkSuperAdmin } from '@/lib/auth/admin';

describe('Super Admin server-side authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentAccount.mockRejectedValue(new Error('No fallback session'));
    mocks.profileMaybeSingle.mockResolvedValue({ data: null, error: null });
  });

  it('does not treat an email address as authorization', async () => {
    // This test previously asserted the opposite of its own name:
    //   await expect(checkSuperAdmin('susantalohr@gmail.com')).resolves.toBe(true)
    // which is exactly the behaviour the name forbids, and is why the
    // email-as-authorization path survived CI. The platform-owner address is
    // now just an ordinary email: an authenticated session carrying it, whose
    // profile has is_super_admin = false, must be denied.
    mocks.getUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-claiming-owner-email',
          email: 'susantalohr@gmail.com',
        },
      },
      error: null,
    });
    mocks.profileMaybeSingle.mockResolvedValue({
      data: { is_super_admin: false },
      error: null,
    });

    await expect(checkSuperAdmin()).resolves.toBe(false);
  });

  it('grants access only when the authenticated profile has the role', async () => {
    mocks.getUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-platform-admin',
          email: 'admin@example.com',
        },
      },
      error: null,
    });
    mocks.profileMaybeSingle.mockResolvedValue({
      data: { is_super_admin: true },
      error: null,
    });

    await expect(checkSuperAdmin()).resolves.toBe(true);
  });

  it('fails closed when profile lookup fails', async () => {
    mocks.getUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-platform-admin',
          email: 'admin@example.com',
        },
      },
      error: null,
    });
    mocks.profileMaybeSingle.mockResolvedValue({
      data: null,
      error: { message: 'database unavailable' },
    });

    await expect(checkSuperAdmin()).resolves.toBe(false);
  });
});
