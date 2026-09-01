import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRequireRole } = vi.hoisted(() => ({
  mockRequireRole: vi.fn(),
}));

vi.mock('@/lib/auth/account', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/auth/account')>(
      '@/lib/auth/account'
    );
  return { ...actual, requireRole: mockRequireRole };
});

import { ForbiddenError } from '@/lib/auth/account';
import {
  isTravelWorkplaceIndustry,
  requireTravelWorkplace,
} from '@/lib/travel/access';

function contextFor(industry: string) {
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: { industry }, error: null }),
  };
  return {
    accountId: 'account-1',
    userId: 'user-1',
    role: 'agent',
    admin: { from: vi.fn().mockReturnValue(query) },
  };
}

describe('travel workspace access', () => {
  beforeEach(() => mockRequireRole.mockReset());

  it('recognizes travel aliases', () => {
    expect(isTravelWorkplaceIndustry('travel')).toBe(true);
    expect(isTravelWorkplaceIndustry('Travel')).toBe(true);
  });

  it('rejects non-travel industries', () => {
    expect(isTravelWorkplaceIndustry('coaching')).toBe(false);
    expect(isTravelWorkplaceIndustry('education')).toBe(false);
    expect(isTravelWorkplaceIndustry('solo_teacher')).toBe(false);
    expect(isTravelWorkplaceIndustry('general')).toBe(false);
    expect(isTravelWorkplaceIndustry('hospital_clinic')).toBe(false);
    expect(isTravelWorkplaceIndustry('salon')).toBe(false);
    expect(isTravelWorkplaceIndustry(null)).toBe(false);
  });

  it('allows only travel workspaces after role authorization', async () => {
    const context = contextFor('travel');
    mockRequireRole.mockResolvedValue(context);

    await expect(requireTravelWorkplace('agent')).resolves.toBe(context);
    expect(context.admin.from).toHaveBeenCalledWith('accounts');
  });

  it('rejects non-travel workspaces even when the user has the right role', async () => {
    mockRequireRole.mockResolvedValue(contextFor('hospital_clinic'));

    await expect(requireTravelWorkplace('agent')).rejects.toBeInstanceOf(
      ForbiddenError
    );
  });
});
