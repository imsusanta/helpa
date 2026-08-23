import { describe, expect, it } from 'vitest';

import {
  getIndustryModule,
  resolveSystemPrompt,
  INDUSTRY_REGISTRY,
} from './registry';
import { getIndustryTerminology } from './terminology';

describe('INDUSTRY_REGISTRY', () => {
  it('registers all core industry modules with valid manifests', () => {
    const expectedModules = [
      'hospital_clinic',
      'coaching',
      'real_estate',
      'travel',
      'gym',
      'restaurant',
      'solo_teacher',
      'salon',
    ];

    for (const modKey of expectedModules) {
      const mod = INDUSTRY_REGISTRY[modKey];
      expect(mod).toBeDefined();
      expect(mod.id).toBe(modKey);
      expect(mod.name).toBeTruthy();
      expect(mod.sidebar.length).toBeGreaterThan(0);
      expect(mod.dashboardMetrics.length).toBeGreaterThan(0);
      expect(mod.systemPrompt).toBeTruthy();
      expect(mod.kbTemplates.length).toBeGreaterThan(0);
      expect(mod.campaignTemplates.length).toBeGreaterThan(0);
    }
  });

  it('correctly maps all industry aliases', () => {
    expect(getIndustryModule('health').id).toBe('hospital_clinic');
    expect(getIndustryModule('tutor').id).toBe('solo_teacher');
    expect(getIndustryModule('salon').id).toBe('salon');
    expect(getIndustryModule('spa').id).toBe('salon');
    expect(getIndustryModule('beauty').id).toBe('salon');
    expect(getIndustryModule('coaching').id).toBe('coaching');
    expect(getIndustryModule('real_estate').id).toBe('real_estate');
    expect(getIndustryModule('travel').id).toBe('travel');
    expect(getIndustryModule('gym').id).toBe('gym');
    expect(getIndustryModule('restaurant').id).toBe('restaurant');
    expect(getIndustryModule(null).id).toBe('general');
  });

  it('provides complete terminology for every registered industry', () => {
    const keys = Object.keys(getIndustryTerminology('general'));
    for (const industryModule of Object.values(INDUSTRY_REGISTRY)) {
      expect(industryModule.terminology).toBeDefined();
      for (const key of keys) {
        expect(
          industryModule.terminology?.[
            key as keyof NonNullable<typeof industryModule.terminology>
          ]
        ).toBeTruthy();
      }
    }
  });

  it('keeps sidebar labels aligned with terminology on shared routes', () => {
    for (const industryModule of Object.values(INDUSTRY_REGISTRY)) {
      const terms = industryModule.terminology!;
      const labelsByRoute = new Map(
        industryModule.sidebar.map((item) => [item.href, item.label])
      );
      if (labelsByRoute.has('/appointments')) {
        expect(labelsByRoute.get('/appointments')).toBe(terms.meetings);
      }
      if (labelsByRoute.has('/contacts')) {
        expect(labelsByRoute.get('/contacts')).toBe(terms.contacts);
      }
    }
  });

  it('marks health as ACTIVE and future modules as COMING_SOON', () => {
    expect(getIndustryModule('health').status).toBe('ACTIVE');
    expect(getIndustryModule('coaching').status).toBe('COMING_SOON');
    expect(getIndustryModule('tutor').status).toBe('COMING_SOON');
    expect(getIndustryModule('salon').status).toBe('COMING_SOON');
    expect(getIndustryModule('real_estate').status).toBe('COMING_SOON');
    expect(getIndustryModule('health').aiTools).toBeDefined();
  });
});

describe('resolveSystemPrompt', () => {
  it('uses the selected workspace template when no custom prompt is saved', () => {
    expect(resolveSystemPrompt('hospital_clinic', null)).toBe(
      getIndustryModule('hospital_clinic').systemPrompt
    );
    expect(resolveSystemPrompt('hospital', null)).toBe(
      getIndustryModule('hospital_clinic').systemPrompt
    );
    expect(resolveSystemPrompt('salon', null)).toBe(
      getIndustryModule('salon').systemPrompt
    );
    expect(resolveSystemPrompt('travel', '')).toBe(
      getIndustryModule('travel').systemPrompt
    );
  });

  it('keeps a non-empty workspace-specific prompt', () => {
    expect(
      resolveSystemPrompt('coaching', '  Reply as an admissions guide.  ')
    ).toBe('Reply as an admissions guide.');
  });
});
