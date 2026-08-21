import { describe, expect, it } from 'vitest';
import { canAccessFeature } from '@/core/billing/feature-registry';
import {
  getIndustryModule,
  resolveCanonicalIndustry,
} from '@/modules/registry';

describe('industry and feature identifier hardening', () => {
  it('normalizes case and whitespace before resolving the industry module', () => {
    expect(resolveCanonicalIndustry(' Health ')).toBe('hospital_clinic');
    expect(resolveCanonicalIndustry('REAL_ESTATE')).toBe('real_estate');
    expect(getIndustryModule(' Health ').id).toBe('hospital_clinic');
    expect(getIndustryModule('REAL_ESTATE').id).toBe('real_estate');
  });

  it('maps canonical industry aliases to their feature domains', async () => {
    await expect(
      canAccessFeature(
        {
          id: 'account-health',
          industry: 'hospital_clinic',
          subscriptionPlanId: 'plan_growth',
          subscriptionStatus: 'ACTIVE',
        },
        'health.patient_profiles'
      )
    ).resolves.toMatchObject({ allowed: true });

    await expect(
      canAccessFeature(
        {
          id: 'account-realty',
          industry: 'real_estate',
          subscriptionPlanId: 'plan_growth',
          subscriptionStatus: 'ACTIVE',
        },
        'realestate.lead_pipeline'
      )
    ).resolves.toMatchObject({ allowed: true });

    await expect(
      canAccessFeature(
        {
          id: 'account-teacher',
          industry: 'solo_teacher',
          subscriptionPlanId: 'plan_growth',
          subscriptionStatus: 'ACTIVE',
        },
        'tutor.students'
      )
    ).resolves.toMatchObject({ allowed: true });
  });

  it('does not grant access on substring collisions', async () => {
    const result = await canAccessFeature(
      {
        id: 'account-health',
        industry: 'healthcare-provider',
        subscriptionPlanId: 'plan_growth',
        subscriptionStatus: 'ACTIVE',
      },
      'health.patient_profiles'
    );

    expect(result.allowed).toBe(false);
  });

  it('rejects malformed feature identifiers', async () => {
    const result = await canAccessFeature(
      {
        id: 'account-health',
        industry: 'health',
        subscriptionPlanId: 'plan_growth',
        subscriptionStatus: 'ACTIVE',
      },
      'health'
    );

    expect(result).toMatchObject({
      allowed: false,
      reason: 'Invalid feature identifier.',
    });
  });
});
