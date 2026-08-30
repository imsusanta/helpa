import { describe, expect, it } from 'vitest';
import { isTravelWorkplaceIndustry } from './access';

describe('travel workplace gate', () => {
  it('accepts only the travel industry alias', () => {
    expect(isTravelWorkplaceIndustry('travel')).toBe(true);
    expect(isTravelWorkplaceIndustry('Travel')).toBe(true);
  });

  it('rejects education, telegram-style, social, and generic CRM industries', () => {
    expect(isTravelWorkplaceIndustry('coaching')).toBe(false);
    expect(isTravelWorkplaceIndustry('education')).toBe(false);
    expect(isTravelWorkplaceIndustry('solo_teacher')).toBe(false);
    expect(isTravelWorkplaceIndustry('general')).toBe(false);
    expect(isTravelWorkplaceIndustry('hospital_clinic')).toBe(false);
    expect(isTravelWorkplaceIndustry('salon')).toBe(false);
    expect(isTravelWorkplaceIndustry(null)).toBe(false);
  });
});
