import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requireRole } = vi.hoisted(() => ({
  requireRole: vi.fn(),
}));

vi.mock('./account', () => ({
  ForbiddenError: class ForbiddenError extends Error {
    readonly status = 403;
  },
  requireRole,
}));

import {
  requireCoachingWorkplace,
  requireEducationWorkplace,
  requireGymWorkplace,
  requireHealthWorkplace,
  requireIndustryWorkplace,
  requireRealEstateWorkplace,
  requireRestaurantWorkplace,
  requireSalonWorkplace,
  requireTravelWorkplace,
} from './industry';

function context(industry: string) {
  return {
    userId: 'user-1',
    accountId: 'tenant-1',
    role: 'owner',
    industry,
    account: { id: 'tenant-1', name: 'Tenant', industry },
    admin: {},
    appwrite: {},
  };
}

describe('industry auth guards', () => {
  beforeEach(() => {
    requireRole.mockReset();
  });

  it.each([
    ['health', requireHealthWorkplace],
    ['travel', requireTravelWorkplace],
    ['coaching', requireCoachingWorkplace],
    ['solo_teacher', requireEducationWorkplace],
    ['salon', requireSalonWorkplace],
    ['real_estate', requireRealEstateWorkplace],
    ['gym', requireGymWorkplace],
    ['restaurant', requireRestaurantWorkplace],
  ])('allows the %s wrapper for its matching workspace', async (industry, guard) => {
    const ctx = context(industry);
    requireRole.mockResolvedValue(ctx);

    await expect(guard()).resolves.toBe(ctx);
    expect(requireRole).toHaveBeenCalledWith('viewer');
  });

  it('accepts any explicitly allowed canonical industry', async () => {
    const ctx = context('coaching');
    requireRole.mockResolvedValue(ctx);

    await expect(
      requireIndustryWorkplace(['coaching', 'solo_teacher'], 'agent')
    ).resolves.toBe(ctx);
    expect(requireRole).toHaveBeenCalledWith('agent');
  });

  it('rejects a mismatched stored industry with the labeled message', async () => {
    requireRole.mockResolvedValue(context('travel'));

    await expect(
      requireIndustryWorkplace('hospital_clinic', 'viewer', 'Health & Clinic')
    ).rejects.toThrow(
      'This feature is only available to Health & Clinic workspaces'
    );
  });

  it('rejects a mismatched stored industry with the generic message', async () => {
    requireRole.mockResolvedValue(context('travel'));

    await expect(requireIndustryWorkplace('coaching')).rejects.toThrow(
      'This feature is not available for your workspace industry'
    );
  });

  it('loads a missing industry from the tenant account row', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { industry: 'travel' },
      error: null,
    });
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));
    const ctx = {
      ...context(''),
      account: { id: 'tenant-1', name: 'Tenant', industry: '' },
      admin: { from },
    };
    requireRole.mockResolvedValue(ctx);

    await expect(requireIndustryWorkplace('travel')).resolves.toBe(ctx);
    expect(from).toHaveBeenCalledWith('accounts');
    expect(eq).toHaveBeenCalledWith('id', 'tenant-1');
  });

  it('fails closed when the account lookup errors', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'database unavailable' },
    });
    const ctx = {
      ...context(''),
      account: { id: 'tenant-1', name: 'Tenant', industry: '' },
      admin: {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({ maybeSingle })),
          })),
        })),
      },
    };
    requireRole.mockResolvedValue(ctx);

    await expect(requireIndustryWorkplace('travel')).rejects.toThrow(
      'This feature is not available for your workspace industry'
    );
  });
});
