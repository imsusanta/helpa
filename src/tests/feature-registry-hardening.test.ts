import { describe, expect, it } from 'vitest';
import { canAccessFeature } from '@/core/billing/feature-registry';
import { getIndustryModule } from '@/modules/registry';

describe('industry and feature identifier hardening', () => {
  it('normalizes casing and whitespace before module resolution', () => {
    expect(getIndustryModule(' Health ').id).toBe('hospital_clinic');
    expect(getIndustryModule(' REAL_ESTATE ').id).toBe('real_estate');
    expect(getIndustryModule(' Solo_Teacher ').id).toBe('solo_teacher');
  });

  it('matches canonical feature domains without substring comparisons', async () => {
    await expect(
      canAccessFeature(
        {
          id: 'workspace-real-estate',
          industry: 'real_estate',
          subscriptionPlanId: 'plan_growth',
          subscriptionStatus: 'ACTIVE',
        },
        'realestate.properties'
      )
    ).resolves.toMatchObject({ allowed: true });

    await expect(
      canAccessFeature(
        {
          id: 'workspace-health',
          industry: 'hospital_clinic',
          subscriptionPlanId: 'plan_growth',
          subscriptionStatus: 'ACTIVE',
        },
        'salon.services'
      )
    ).resolves.toMatchObject({ allowed: false });
  });

  it('rejects malformed feature identifiers', async () => {
    await expect(
      canAccessFeature(
        {
          id: 'workspace-health',
          industry: 'health',
          subscriptionPlanId: 'plan_growth',
          subscriptionStatus: 'ACTIVE',
        },
        'health.appointments.extra'
      )
    ).resolves.toMatchObject({ allowed: false });
  });
});
