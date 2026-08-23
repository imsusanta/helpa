import { describe, expect, it } from 'vitest';
import {
  GENERAL_INDUSTRY_TERMINOLOGY,
  getIndustryTerminology,
  resolveIndustryAlias,
} from './terminology';

describe('industry terminology', () => {
  it('resolves hospital and clinic aliases to one canonical industry', () => {
    for (const alias of ['hospital_clinic', 'health', 'clinic', 'hospital']) {
      expect(resolveIndustryAlias(alias)).toBe('hospital_clinic');
    }
  });

  it('falls back safely for empty and unknown industries', () => {
    expect(getIndustryTerminology('unknown')).toEqual(
      GENERAL_INDUSTRY_TERMINOLOGY
    );
    expect(getIndustryTerminology(null).meeting).toBe('Meeting');
  });

  it.each([
    ['hospital_clinic', 'Appointment', 'Appointments', 'Patient'],
    ['salon', 'Appointment', 'Appointments', 'Client'],
    ['restaurant', 'Reservation', 'Reservations', 'Guest'],
    ['real_estate', 'Site Visit', 'Site Visits', 'Lead'],
    ['coaching', 'Counselling Session', 'Counselling Sessions', 'Student'],
    ['gym', 'Training Session', 'Training Sessions', 'Member'],
    ['general', 'Meeting', 'Meetings', 'Contact'],
  ])(
    '%s maps scheduling and person context',
    (industry, meeting, meetings, person) => {
      const terms = getIndustryTerminology(industry);
      expect(terms.meeting).toBe(meeting);
      expect(terms.meetings).toBe(meetings);
      expect(terms.contact).toBe(person);
    }
  );

  it('uses admission enquiry language for education', () => {
    const terms = getIndustryTerminology('education');
    expect(terms.contact).toBe('Student');
    expect(terms.pipelineItem).toBe('Admission Enquiry');
  });

  it('changes visible wording without changing internal identifiers', () => {
    expect(getIndustryTerminology('hospital').meeting).toBe('Appointment');
    expect('/appointments').toBe('/appointments');
    expect('conversations').toBe('conversations');
    expect('deals').toBe('deals');
  });
});
