import { describe, expect, it } from 'vitest';
import {
  GENERAL_INDUSTRY_TERMINOLOGY,
  getIndustryTerminology,
  resolveIndustryAlias,
} from './terminology';

describe('industry terminology', () => {
  it('resolves supported aliases to one canonical industry', () => {
    expect(resolveIndustryAlias('health')).toBe('hospital_clinic');
    expect(resolveIndustryAlias('hospital')).toBe('hospital_clinic');
    expect(resolveIndustryAlias('clinic')).toBe('hospital_clinic');
    expect(resolveIndustryAlias('education')).toBe('coaching');
    expect(resolveIndustryAlias('tutor')).toBe('solo_teacher');
    expect(resolveIndustryAlias('spa')).toBe('salon');
    expect(resolveIndustryAlias('fitness')).toBe('gym');
    expect(resolveIndustryAlias('cafe')).toBe('restaurant');
    expect(resolveIndustryAlias('property')).toBe('real_estate');
  });

  it('uses general-business terminology for unknown or empty industries', () => {
    expect(getIndustryTerminology('unknown').meeting).toBe('Meeting');
    expect(getIndustryTerminology(null)).toEqual(GENERAL_INDUSTRY_TERMINOLOGY);
  });

  it.each([
    ['hospital_clinic', 'Appointment', 'Appointments', 'Patient'],
    ['salon', 'Appointment', 'Appointments', 'Client'],
    ['restaurant', 'Reservation', 'Reservations', 'Guest'],
    ['real_estate', 'Site Visit', 'Site Visits', 'Lead'],
    ['coaching', 'Counselling Session', 'Counselling Sessions', 'Student'],
    ['gym', 'Training Session', 'Training Sessions', 'Member'],
    ['travel', 'Travel Consultation', 'Travel Consultations', 'Traveller'],
  ] as const)(
    '%s maps meeting, plural meeting, and contact context',
    (industry, meeting, meetings, contact) => {
      const terms = getIndustryTerminology(industry);
      expect(terms.meeting).toBe(meeting);
      expect(terms.meetings).toBe(meetings);
      expect(terms.contact).toBe(contact);
    }
  );

  it('keeps internal identifiers separate from visible terminology', () => {
    expect(getIndustryTerminology('hospital').meeting).toBe('Appointment');
    expect('/appointments').toBe('/appointments');
    expect('conversations').toBe('conversations');
    expect('deals').toBe('deals');
  });
});
