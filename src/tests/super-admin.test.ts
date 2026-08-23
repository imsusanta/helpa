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

import { checkSuperAdmin, isPlatformOwnerEmail } from '@/lib/auth/admin';

describe('Super Admin server-side authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentAccount.mockRejectedValue(new Error('No fallback session'));
    mocks.profileMaybeSingle.mockResolvedValue({ data: null, error: null });
  });

  it('does not treat an email address as authorization', async () => {
    mocks.getUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-normal',
          email: 'normal@example.com',
        },
      },
      error: null,
    });
    mocks.profileMaybeSingle.mockResolvedValue({
      data: { is_super_admin: false },
      error: null,
    });

    expect(isPlatformOwnerEmail('normal@example.com')).toBe(false);
    expect(isPlatformOwnerEmail('susantalohr@gmail.com')).toBe(true);
    await expect(checkSuperAdmin('susantalohr@gmail.com')).resolves.toBe(true);
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
