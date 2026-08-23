import { describe, expect, it } from 'vitest';
import {
  GENERAL_FORM_SUGGESTION,
  getSuggestedFormFields,
  validateSubmissionData,
} from './form-fields';
import type { LeadFormField } from '@/types';

const FIELDS: LeadFormField[] = [
  { key: 'name', label: 'Name', type: 'text', required: true },
  { key: 'email', label: 'Email', type: 'email', required: false },
  { key: 'phone', label: 'Phone', type: 'phone', required: true },
  { key: 'guests', label: 'Guests', type: 'number', required: false },
  {
    key: 'reservation_date',
    label: 'Reservation Date',
    type: 'date',
    required: false,
  },
];

describe('getSuggestedFormFields', () => {
  it('returns industry-specific fields for a known industry', () => {
    const fields = getSuggestedFormFields('Hospital_Clinic');
    expect(fields.some((f) => f.key === 'preferred_doctor')).toBe(true);
    // Base fields are always present.
    expect(fields.slice(0, 2)).toEqual([
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'phone', label: 'Phone', type: 'phone', required: true },
    ]);
  });

  it('falls back to the general template for unknown industries', () => {
    expect(getSuggestedFormFields('underwater_welding')).toEqual(
      GENERAL_FORM_SUGGESTION
    );
  });

  it('falls back when industry is null or whitespace', () => {
    expect(getSuggestedFormFields(null)).toEqual(GENERAL_FORM_SUGGESTION);
    expect(getSuggestedFormFields('   ')).toEqual(GENERAL_FORM_SUGGESTION);
  });
});

describe('validateSubmissionData', () => {
  it('rejects honeypot submissions outright', () => {
    const { data, violations } = validateSubmissionData(FIELDS, {
      company_website: 'https://spam.example',
      name: 'Bot',
    });
    expect(data).toEqual({});
    expect(violations).toEqual([
      { key: '_', message: 'Submission rejected' },
    ]);
  });

  it('flags missing required fields and keeps optional ones absent', () => {
    const { data, violations } = validateSubmissionData(FIELDS, {});
    expect(data).toEqual({});
    expect(violations.map((v) => v.message)).toEqual(
      expect.arrayContaining(['Name is required', 'Phone is required'])
    );
  });

  it('accepts a fully valid submission and normalizes values', () => {
    const { data, violations } = validateSubmissionData(FIELDS, {
      name: '  Ayesha  ',
      email: 'Ayesha@Example.COM ',
      phone: '+880 1712-345 678',
      guests: '4',
      reservation_date: '2026-09-01',
    });
    expect(violations).toEqual([]);
    expect(data).toEqual({
      name: 'Ayesha',
      email: 'ayesha@example.com',
      phone: '+8801712345678',
      guests: '4',
      reservation_date: '2026-09-01',
    });
  });

  it('validates each field type', () => {
    const { violations } = validateSubmissionData(FIELDS, {
      name: 'x',
      phone: '12345', // too short after normalization
      email: 'not-an-email',
      guests: 'four',
      reservation_date: 'sometime soon',
    });
    expect(violations).toEqual([
      { key: 'email', message: 'Email is not a valid email' },
      { key: 'phone', message: 'Phone is not a valid phone number' },
      { key: 'guests', message: 'Guests must be a number' },
      { key: 'reservation_date', message: 'Reservation Date must be a valid date' },
    ]);
  });

  it('rejects oversized values', () => {
    const { violations } = validateSubmissionData([{ ...FIELDS[0] }], {
      name: 'x'.repeat(1001),
    });
    expect(violations).toEqual([{ key: 'name', message: 'Name is too long' }]);
  });

  it('tolerates non-object payloads', () => {
    const result = validateSubmissionData(FIELDS, 'injected');
    expect(result.violations.length).toBeGreaterThan(0);
    expect(result.data).toEqual({});
  });
});
