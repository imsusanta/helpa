import { describe, expect, it } from 'vitest';

import { getIndustryModule, resolveSystemPrompt } from './registry';

describe('resolveSystemPrompt', () => {
  it('uses the selected workspace template when no custom prompt is saved', () => {
    expect(resolveSystemPrompt('hospital_clinic', null)).toBe(
      getIndustryModule('hospital_clinic').systemPrompt
    );
    expect(resolveSystemPrompt('hospital', null)).toBe(
      getIndustryModule('hospital_clinic').systemPrompt
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
