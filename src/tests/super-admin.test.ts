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

  it('never treats an email address as authorization evidence', async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'No authenticated session' },
    });

    expect(isPlatformOwnerEmail('susantalohr@gmail.com')).toBe(false);
    await expect(checkSuperAdmin('susantalohr@gmail.com')).resolves.toBe(false);
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
