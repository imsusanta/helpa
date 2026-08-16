import { describe, expect, it } from 'vitest';

import {
  getIndustryModule,
  resolveSystemPrompt,
  INDUSTRY_REGISTRY,
} from './registry';

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
