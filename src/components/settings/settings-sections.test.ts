import { describe, expect, it } from 'vitest';
import { isSectionVisible } from './settings-sections';

describe('settings section visibility', () => {
  it('keeps Health Insurance clinic-only', () => {
    expect(isSectionVisible('insurance', 'hospital_clinic')).toBe(true);
    expect(isSectionVisible('insurance', 'health')).toBe(true);
    expect(isSectionVisible('insurance', 'travel')).toBe(false);
    expect(isSectionVisible('insurance', 'general')).toBe(false);
  });

  it('keeps shared workspace sections available for every industry', () => {
    expect(isSectionVisible('members', 'travel')).toBe(true);
    expect(isSectionVisible('booking_form', 'travel')).toBe(true);
    expect(isSectionVisible('whatsapp', 'hospital_clinic')).toBe(true);
  });
});
