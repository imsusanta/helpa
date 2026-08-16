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
    expect(health.allowedRoutes).toContain('/admin');
    expect(health.allowedRoutes).not.toContain('/properties');
    expect(health.allowedRoutes).not.toContain('/services');

    const salon = getIndustryModule('salon');
    expect(salon.allowedRoutes).toContain('/customers');
    expect(salon.allowedRoutes).toContain('/services');
    expect(salon.allowedRoutes).toContain('/staff');
    expect(salon.allowedRoutes).toContain('/admin');
    expect(salon.allowedRoutes).not.toContain('/patients');
    expect(salon.allowedRoutes).not.toContain('/doctors');

    const realEstate = getIndustryModule('real_estate');
    expect(realEstate.allowedRoutes).toContain('/leads');
    expect(realEstate.allowedRoutes).toContain('/properties');
    expect(realEstate.allowedRoutes).toContain('/agents');
    expect(realEstate.allowedRoutes).toContain('/site-visits');
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
});
