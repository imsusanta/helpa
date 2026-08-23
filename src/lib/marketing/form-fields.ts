/**
 * Marketing — Lead Form field catalogue.
 *
 * Industry-aware field suggestions reuse the existing industry registry
 * (`src/modules/registry.ts`). These are default templates only — every
 * stored form carries its own explicit field list in `lead_forms.fields`.
 */

import type { LeadFormField } from '@/types';

export const FORM_FIELD_TYPES = [
  'text',
  'email',
  'phone',
  'date',
  'number',
  'textarea',
] as const;

const BASE_FIELDS: LeadFormField[] = [
  { key: 'name', label: 'Name', type: 'text', required: true },
  { key: 'phone', label: 'Phone', type: 'phone', required: true },
];

const INDUSTRY_FIELD_SUGGESTIONS: Record<string, LeadFormField[]> = {
  hospital_clinic: [
    ...BASE_FIELDS,
    { key: 'service', label: 'Service', type: 'text', required: false },
    {
      key: 'preferred_doctor',
      label: 'Preferred Doctor',
      type: 'text',
      required: false,
    },
    {
      key: 'preferred_date',
      label: 'Preferred Date',
      type: 'date',
      required: false,
    },
  ],
  travel: [
    ...BASE_FIELDS,
    { key: 'destination', label: 'Destination', type: 'text', required: false },
    {
      key: 'travel_date',
      label: 'Travel Date',
      type: 'date',
      required: false,
    },
    {
      key: 'travellers',
      label: 'Number of Travellers',
      type: 'number',
      required: false,
    },
  ],
  restaurant: [
    ...BASE_FIELDS,
    {
      key: 'reservation_date',
      label: 'Reservation Date',
      type: 'date',
      required: false,
    },
    { key: 'guests', label: 'Guests', type: 'number', required: false },
    {
      key: 'special_request',
      label: 'Special Request',
      type: 'textarea',
      required: false,
    },
  ],
  solo_teacher: [
    ...BASE_FIELDS,
    { key: 'course', label: 'Course', type: 'text', required: false },
    {
      key: 'preferred_batch',
      label: 'Preferred Batch',
      type: 'text',
      required: false,
    },
    { key: 'message', label: 'Message', type: 'textarea', required: false },
  ],
  coaching: [
    ...BASE_FIELDS,
    { key: 'course', label: 'Course', type: 'text', required: false },
    {
      key: 'preferred_batch',
      label: 'Preferred Batch',
      type: 'text',
      required: false,
    },
    { key: 'message', label: 'Message', type: 'textarea', required: false },
  ],
  salon: [
    ...BASE_FIELDS,
    { key: 'service', label: 'Service', type: 'text', required: false },
    {
      key: 'preferred_date',
      label: 'Preferred Date',
      type: 'date',
      required: false,
    },
    {
      key: 'preferred_staff',
      label: 'Preferred Staff',
      type: 'text',
      required: false,
    },
  ],
  real_estate: [
    ...BASE_FIELDS,
    {
      key: 'property_type',
      label: 'Property Type',
      type: 'text',
      required: false,
    },
    { key: 'budget', label: 'Budget', type: 'text', required: false },
    {
      key: 'preferred_location',
      label: 'Preferred Location',
      type: 'text',
      required: false,
    },
  ],
  gym: [
    ...BASE_FIELDS,
    {
      key: 'membership_type',
      label: 'Membership Type',
      type: 'text',
      required: false,
    },
    {
      key: 'preferred_time',
      label: 'Preferred Time',
      type: 'text',
      required: false,
    },
  ],
};

/** General fallback per spec: Name / Phone / Email / Message. */
export const GENERAL_FORM_SUGGESTION: LeadFormField[] = [
  ...BASE_FIELDS,
  { key: 'email', label: 'Email', type: 'email', required: false },
  { key: 'message', label: 'Message', type: 'textarea', required: false },
];

/**
 * Resolves the suggested starter fields for a workspace industry.
 * Unknown industries fall back to the general template.
 */
export function getSuggestedFormFields(
  industry: string | null
): LeadFormField[] {
  if (!industry) return GENERAL_FORM_SUGGESTION;
  const key = industry.trim().toLowerCase();
  return INDUSTRY_FIELD_SUGGESTIONS[key] ?? GENERAL_FORM_SUGGESTION;
}

/* ────────────────────────────────────────────────────────────
 * Server-side validation of public submissions
 * ──────────────────────────────────────────────────────────── */

export interface FieldViolation {
  key: string;
  message: string;
}

const PHONE_PATTERN = /^\+?[0-9]{7,15}$/;

function normalizePhone(value: string): string {
  // Keep leading + and digits; strip separators users commonly type.
  const trimmed = value.replace(/[^0-9+]/g, '');
  return trimmed.startsWith('+') ? trimmed : trimmed.replace(/\+/g, '');
}

/**
 * Validates a raw submission payload against the stored form definition.
 * Returns the sanitized payload plus per-field violations. Never throws —
 * callers decide how to surface violations to the submitter.
 */
export function validateSubmissionData(
  fields: LeadFormField[],
  raw: unknown
): { data: Record<string, string>; violations: FieldViolation[] } {
  const violations: FieldViolation[] = [];
  const data: Record<string, string> = {};

  const input =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  // Honeypot — bots fill hidden fields; humans never see them.
  if (
    typeof input.company_website === 'string' &&
    input.company_website.trim() !== ''
  ) {
    return {
      data: {},
      violations: [{ key: '_', message: 'Submission rejected' }],
    };
  }

  for (const field of fields) {
    const value = input[field.key];
    const str = typeof value === 'string' ? value.trim() : '';

    if (!str) {
      if (field.required) {
        violations.push({
          key: field.key,
          message: `${field.label} is required`,
        });
      }
      continue;
    }

    if (str.length > 1000) {
      violations.push({
        key: field.key,
        message: `${field.label} is too long`,
      });
      continue;
    }

    switch (field.type) {
      case 'email': {
        const email = str.toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          violations.push({
            key: field.key,
            message: `${field.label} is not a valid email`,
          });
        } else {
          data[field.key] = email;
        }
        break;
      }
      case 'phone': {
        const phone = normalizePhone(str);
        if (!PHONE_PATTERN.test(phone)) {
          violations.push({
            key: field.key,
            message: `${field.label} is not a valid phone number`,
          });
        } else {
          data[field.key] = phone;
        }
        break;
      }
      case 'number': {
        if (!/^-?\d+(\.\d+)?$/.test(str)) {
          violations.push({
            key: field.key,
            message: `${field.label} must be a number`,
          });
        } else {
          data[field.key] = str;
        }
        break;
      }
      case 'date': {
        if (Number.isNaN(Date.parse(str))) {
          violations.push({
            key: field.key,
            message: `${field.label} must be a valid date`,
          });
        } else {
          data[field.key] = str;
        }
        break;
      }
      default:
        data[field.key] = str;
    }
  }

  return { data, violations };
}
