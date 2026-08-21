import { describe, expect, it } from 'vitest';
import { getIndustryModule } from '@/modules/registry';

describe('Phase 2: Dynamic Industry Workspace Manifests', () => {
  const supportedIndustries = [
    'health',
    'coaching',
    'tutor',
    'salon',
    'real_estate',
  ];

  it('resolves valid manifests for all 5 target industries', () => {
    for (const ind of supportedIndustries) {
      const manifest = getIndustryModule(ind);
      expect(manifest).toBeDefined();
      expect(manifest.id).toBeTruthy();
      expect(manifest.name).toBeTruthy();
      expect(manifest.status).toBeDefined();
      expect(['ACTIVE', 'COMING_SOON']).toContain(manifest.status);
      expect(manifest.aiRole).toBeTruthy();
      expect(manifest.terminology).toBeDefined();
      expect(manifest.features).toBeDefined();
      expect(manifest.allowedRoutes).toBeDefined();
      expect(manifest.sidebar.length).toBeGreaterThan(0);
      expect(manifest.dashboardMetrics.length).toBeGreaterThan(0);
    }
  });

  it('marks health as ACTIVE and future industries as COMING_SOON', () => {
    expect(getIndustryModule('health').status).toBe('ACTIVE');
    expect(getIndustryModule('coaching').status).toBe('COMING_SOON');
    expect(getIndustryModule('tutor').status).toBe('COMING_SOON');
    expect(getIndustryModule('salon').status).toBe('COMING_SOON');
    expect(getIndustryModule('real_estate').status).toBe('COMING_SOON');
  });

  it('resolves correct industry-specific terminology', () => {
    // Health Terminology
    const health = getIndustryModule('health');
    expect(health.terminology?.contact).toBe('Patient');
    expect(health.terminology?.contacts).toBe('Patients');
    expect(health.terminology?.booking).toBe('Appointment');
    expect(health.terminology?.staff).toBe('Doctor');
    expect(health.aiRole).toBe('AI Hospital Receptionist');

    // Coaching Terminology
    const coaching = getIndustryModule('coaching');
    expect(coaching.terminology?.contact).toBe('Student');
    expect(coaching.terminology?.contacts).toBe('Students');
    expect(coaching.terminology?.booking).toBe('Admission');
    expect(coaching.terminology?.staff).toBe('Teacher');
    expect(coaching.aiRole).toBe('AI Admission Assistant');

    // Tutor Terminology
    const tutor = getIndustryModule('tutor');
    expect(tutor.terminology?.contact).toBe('Student');
    expect(tutor.terminology?.contacts).toBe('Students');
    expect(tutor.terminology?.booking).toBe('Enrollment');
    expect(tutor.terminology?.staff).toBe('Teacher');
    expect(tutor.aiRole).toBe('AI Teaching Assistant');

    // Salon Terminology
    const salon = getIndustryModule('salon');
    expect(salon.terminology?.contact).toBe('Customer');
    expect(salon.terminology?.contacts).toBe('Customers');
    expect(salon.terminology?.booking).toBe('Appointment');
    expect(salon.terminology?.staff).toBe('Staff');
    expect(salon.aiRole).toBe('AI Salon Receptionist');

    // Real Estate Terminology
    const realEstate = getIndustryModule('real_estate');
    expect(realEstate.terminology?.contact).toBe('Lead');
    expect(realEstate.terminology?.contacts).toBe('Leads');
    expect(realEstate.terminology?.booking).toBe('Site Visit');
    expect(realEstate.terminology?.staff).toBe('Agent');
    expect(realEstate.aiRole).toBe('AI Property Assistant');
  });

  it('enforces route permissions per industry manifest', () => {
    const health = getIndustryModule('health');
    expect(health.allowedRoutes).toContain('/patients');
    expect(health.allowedRoutes).toContain('/doctors');
    expect(health.allowedRoutes).toContain('/appointments');
    expect(health.allowedRoutes).toContain('/pipelines');
    expect(health.allowedRoutes).toContain('/admin');
    expect(health.allowedRoutes).not.toContain('/properties');
    expect(health.allowedRoutes).not.toContain('/services');

    const salon = getIndustryModule('salon');
    expect(salon.allowedRoutes).toContain('/customers');
    expect(salon.allowedRoutes).toContain('/services');
    expect(salon.allowedRoutes).toContain('/staff');
    expect(salon.allowedRoutes).toContain('/pipelines');
    expect(salon.allowedRoutes).toContain('/admin');
    expect(salon.allowedRoutes).not.toContain('/patients');
    expect(salon.allowedRoutes).not.toContain('/doctors');

    const realEstate = getIndustryModule('real_estate');
    expect(realEstate.allowedRoutes).toContain('/leads');
    expect(realEstate.allowedRoutes).toContain('/properties');
    expect(realEstate.allowedRoutes).toContain('/agents');
    expect(realEstate.allowedRoutes).toContain('/site-visits');
    expect(realEstate.allowedRoutes).toContain('/pipelines');
    expect(realEstate.allowedRoutes).toContain('/admin');
    expect(realEstate.allowedRoutes).not.toContain('/patients');
    expect(realEstate.allowedRoutes).not.toContain('/courses');
  });

  it('enforces feature flag isolation per industry', () => {
    const health = getIndustryModule('health');
    expect(health.features?.patients).toBe(true);
    expect(health.features?.doctors).toBe(true);
    expect(health.features?.properties).toBe(false);

    const coaching = getIndustryModule('coaching');
    expect(coaching.features?.students).toBe(true);
    expect(coaching.features?.teachers).toBe(true);
    expect(coaching.features?.patients).toBe(false);

    const salon = getIndustryModule('salon');
    expect(salon.features?.customers).toBe(true);
    expect(salon.features?.services).toBe(true);
    expect(salon.features?.patients).toBe(false);
  });

  it('gracefully handles missing or unknown industry keys with fallback', () => {
    const unknown = getIndustryModule('unknown_industry_xyz');
    expect(unknown.id).toBe('general');

    const nullIndustry = getIndustryModule(null);
    expect(nullIndustry.id).toBe('general');
  });

  describe('Business Type Canonical Selection & Server Validation', () => {
    it('provides exactly 8 canonical business type options', async () => {
      const { BUSINESS_TYPE_OPTIONS } = await import('@/modules/registry');
      expect(BUSINESS_TYPE_OPTIONS).toHaveLength(8);
      const ids = BUSINESS_TYPE_OPTIONS.map((opt) => opt.id);
      expect(ids).toContain('hospital_clinic');
      expect(ids).toContain('travel');
      expect(ids).toContain('restaurant');
      expect(ids).toContain('coaching');
      expect(ids).toContain('salon');
      expect(ids).toContain('real_estate');
      expect(ids).toContain('gym');
      expect(ids).toContain('general');
    });

    it('resolves canonical keys for UI labels and aliases correctly', async () => {
      const { resolveCanonicalIndustry } = await import('@/modules/registry');
      expect(resolveCanonicalIndustry('health')).toBe('hospital_clinic');
      expect(resolveCanonicalIndustry('hospital_clinic')).toBe(
        'hospital_clinic'
      );
      expect(resolveCanonicalIndustry('travel')).toBe('travel');
      expect(resolveCanonicalIndustry('restaurant')).toBe('restaurant');
      expect(resolveCanonicalIndustry('cafe')).toBe('restaurant');
      expect(resolveCanonicalIndustry('education')).toBe('coaching');
      expect(resolveCanonicalIndustry('coaching')).toBe('coaching');
      expect(resolveCanonicalIndustry('salon')).toBe('salon');
      expect(resolveCanonicalIndustry('real_estate')).toBe('real_estate');
      expect(resolveCanonicalIndustry('fitness')).toBe('gym');
      expect(resolveCanonicalIndustry('gym')).toBe('gym');
      expect(resolveCanonicalIndustry('other')).toBe('general');
      expect(resolveCanonicalIndustry('general')).toBe('general');
    });

    it('validates canonical and alias inputs while rejecting invalid industries', async () => {
      const { isValidIndustry } = await import('@/modules/registry');
      expect(isValidIndustry('health')).toBe(true);
      expect(isValidIndustry('travel')).toBe(true);
      expect(isValidIndustry('restaurant')).toBe(true);
      expect(isValidIndustry('education')).toBe(true);
      expect(isValidIndustry('salon')).toBe(true);
      expect(isValidIndustry('real_estate')).toBe(true);
      expect(isValidIndustry('fitness')).toBe(true);
      expect(isValidIndustry('other')).toBe(true);
      expect(isValidIndustry('general')).toBe(true);

      // Rejections
      expect(isValidIndustry('')).toBe(false);
      expect(isValidIndustry(null)).toBe(false);
      expect(isValidIndustry(undefined)).toBe(false);
      expect(isValidIndustry('crypto_trading')).toBe(false);
      expect(isValidIndustry('arbitrary_slug')).toBe(false);
    });

    it('validates each business type against getIndustryModule', async () => {
      const { BUSINESS_TYPE_OPTIONS } = await import('@/modules/registry');
      for (const opt of BUSINESS_TYPE_OPTIONS) {
        const mod = getIndustryModule(opt.id);
        expect(mod).toBeDefined();
        expect(mod.id).toBeTruthy();
        expect(mod.sidebar.length).toBeGreaterThan(0);
      }
    });
  });
});
