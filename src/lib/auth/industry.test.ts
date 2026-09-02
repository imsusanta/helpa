import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRequireRole } = vi.hoisted(() => ({
  mockRequireRole: vi.fn(),
}));

vi.mock('./account', async () => {
  const actual = await vi.importActual<typeof import('./account')>('./account');
  return { ...actual, requireRole: mockRequireRole };
});

import { ForbiddenError } from './account';
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

function contextFor(
  industry: string | undefined,
  opts?: {
    adminFrom?: boolean;
    lookupIndustry?: string | null;
    lookupError?: unknown;
  }
) {
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: opts?.lookupIndustry
        ? { industry: opts.lookupIndustry }
        : opts?.lookupIndustry === null
          ? { industry: null }
          : null,
      error: opts?.lookupError ?? null,
    }),
  };
  return {
    accountId: 'account-1',
    userId: 'user-1',
    role: 'agent' as const,
    account: industry === undefined ? {} : { industry },
    admin:
      opts?.adminFrom === false ? {} : { from: vi.fn().mockReturnValue(query) },
  };
}

describe('requireIndustryWorkplace', () => {
  beforeEach(() => mockRequireRole.mockReset());

  it('allows a matching industry on the account row', async () => {
    const context = contextFor('hospital_clinic');
    mockRequireRole.mockResolvedValue(context);
    await expect(
      requireIndustryWorkplace('hospital_clinic', 'agent')
    ).resolves.toBe(context);
  });

  it('resolves aliases such as health → hospital_clinic', async () => {
    const context = contextFor('health');
    mockRequireRole.mockResolvedValue(context);
    await expect(requireIndustryWorkplace('hospital_clinic')).resolves.toBe(
      context
    );
  });

  it('rejects a mismatched industry with a labeled message', async () => {
    mockRequireRole.mockResolvedValue(contextFor('travel'));
    await expect(
      requireIndustryWorkplace('hospital_clinic', 'viewer', 'Health & Clinic')
    ).rejects.toMatchObject({
      status: 403,
      message: 'This feature is only available to Health & Clinic workspaces',
    });
  });

  it('rejects a mismatched industry with the generic message', async () => {
    mockRequireRole.mockResolvedValue(contextFor('salon'));
    await expect(requireIndustryWorkplace('travel')).rejects.toBeInstanceOf(
      ForbiddenError
    );
    await expect(requireIndustryWorkplace('travel')).rejects.toThrow(
      'This feature is not available for your workspace industry'
    );
  });

  it('looks up industry from the database when the account object omits it', async () => {
    const context = contextFor(undefined, { lookupIndustry: 'travel' });
    mockRequireRole.mockResolvedValue(context);
    await expect(requireIndustryWorkplace('travel')).resolves.toBe(context);
    expect(context.admin.from).toHaveBeenCalledWith('accounts');
  });

  it('rejects when the database lookup does not match', async () => {
    mockRequireRole.mockResolvedValue(
      contextFor(undefined, { lookupIndustry: 'gym' })
    );
    await expect(
      requireIndustryWorkplace(
        ['coaching', 'solo_teacher'],
        'viewer',
        'Education & Coaching'
      )
    ).rejects.toThrow(
      'This feature is only available to Education & Coaching workspaces'
    );
  });

  it('rejects when the database lookup errors', async () => {
    mockRequireRole.mockResolvedValue(
      contextFor(undefined, { lookupError: { message: 'unavailable' } })
    );
    await expect(requireIndustryWorkplace('travel')).rejects.toBeInstanceOf(
      ForbiddenError
    );
  });

  it('returns the role context when industry is missing and there is no admin client', async () => {
    const context = contextFor(undefined, { adminFrom: false });
    mockRequireRole.mockResolvedValue(context);
    await expect(requireIndustryWorkplace('travel')).resolves.toBe(context);
  });
});

describe('industry wrappers', () => {
  beforeEach(() => mockRequireRole.mockReset());

  it.each([
    ['health', requireHealthWorkplace, 'hospital_clinic'],
    ['travel', requireTravelWorkplace, 'travel'],
    ['coaching', requireCoachingWorkplace, 'coaching'],
    ['salon', requireSalonWorkplace, 'salon'],
    ['real_estate', requireRealEstateWorkplace, 'real_estate'],
    ['gym', requireGymWorkplace, 'gym'],
    ['restaurant', requireRestaurantWorkplace, 'restaurant'],
  ] as const)(
    '%s wrapper allows a matching workspace',
    async (_label, guard, industry) => {
      const context = contextFor(industry);
      mockRequireRole.mockResolvedValue(context);
      await expect(guard('viewer')).resolves.toBe(context);
    }
  );

  it('education wrapper allows coaching or solo_teacher', async () => {
    const coaching = contextFor('coaching');
    mockRequireRole.mockResolvedValue(coaching);
    await expect(requireEducationWorkplace()).resolves.toBe(coaching);

    const teacher = contextFor('solo_teacher');
    mockRequireRole.mockResolvedValue(teacher);
    await expect(requireEducationWorkplace('agent')).resolves.toBe(teacher);
  });

  it('education wrapper rejects a clinic workspace', async () => {
    mockRequireRole.mockResolvedValue(contextFor('hospital_clinic'));
    await expect(requireEducationWorkplace()).rejects.toBeInstanceOf(
      ForbiddenError
    );
  });
});
