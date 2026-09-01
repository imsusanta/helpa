/**
 * Industry-aware lead qualification. Question sets are configuration,
 * not a hardcoded travel interrogation loop. Unknown values stay null.
 */
import {
  resolveIndustryAlias,
  type CanonicalIndustry,
} from '@/core/modules/terminology';
import { scoreLabelFromNumeric } from '@/lib/leads/lead-detection.service';
import type {
  LeadDetectionResult,
  LeadScoreLabel,
  QualificationField,
  QualificationSnapshot,
} from '@/lib/leads/types';

const GENERAL_FIELDS: QualificationField[] = [
  {
    key: 'service',
    label: 'Service',
    promptHint: 'which service or offering they are asking about',
  },
  {
    key: 'timeline',
    label: 'Timeline',
    promptHint: 'when they would like to proceed',
  },
  {
    key: 'budget',
    label: 'Budget',
    promptHint: 'an approximate budget if they mention one',
  },
];

const INDUSTRY_FIELDS: Record<CanonicalIndustry, QualificationField[]> = {
  travel: [
    {
      key: 'service',
      label: 'Destination / package',
      promptHint: 'destination or package they want',
    },
    {
      key: 'timeline',
      label: 'Travel dates',
      promptHint: 'travel dates if they have them',
    },
    {
      key: 'travellers',
      label: 'Travellers',
      promptHint: 'how many travellers',
    },
    {
      key: 'budget',
      label: 'Budget',
      promptHint: 'approximate budget',
    },
    {
      key: 'trip_type',
      label: 'Trip type',
      promptHint: 'trip type such as family, honeymoon, or business',
    },
  ],
  hospital_clinic: [
    {
      key: 'service',
      label: 'Required service',
      promptHint: 'the service or department they need',
    },
    {
      key: 'timeline',
      label: 'Preferred date',
      promptHint: 'a preferred appointment date',
    },
    {
      key: 'doctor',
      label: 'Preferred doctor',
      promptHint: 'a preferred doctor if they have one',
    },
  ],
  real_estate: [
    {
      key: 'service',
      label: 'Property type',
      promptHint: 'property type such as apartment, villa, or plot',
    },
    {
      key: 'location',
      label: 'Location',
      promptHint: 'preferred location or locality',
    },
    {
      key: 'budget',
      label: 'Budget',
      promptHint: 'budget range',
    },
    {
      key: 'timeline',
      label: 'Timeline',
      promptHint: 'when they want to buy or move',
    },
  ],
  coaching: [
    {
      key: 'service',
      label: 'Course',
      promptHint: 'the course or exam they are asking about',
    },
    {
      key: 'timeline',
      label: 'Batch / start',
      promptHint: 'when they want to join',
    },
    {
      key: 'budget',
      label: 'Budget',
      promptHint: 'fee or budget expectations if mentioned',
    },
  ],
  solo_teacher: [
    {
      key: 'service',
      label: 'Subject',
      promptHint: 'subject or class they need',
    },
    {
      key: 'timeline',
      label: 'Preferred schedule',
      promptHint: 'preferred class timing',
    },
  ],
  salon: [
    {
      key: 'service',
      label: 'Service',
      promptHint: 'the salon service they want',
    },
    {
      key: 'timeline',
      label: 'Preferred date',
      promptHint: 'a preferred date or time',
    },
  ],
  gym: [
    {
      key: 'service',
      label: 'Membership / training',
      promptHint: 'membership or personal training interest',
    },
    {
      key: 'timeline',
      label: 'Start date',
      promptHint: 'when they want to start',
    },
  ],
  restaurant: [
    {
      key: 'service',
      label: 'Booking type',
      promptHint: 'table booking, catering, or enquiry',
    },
    {
      key: 'timeline',
      label: 'Date',
      promptHint: 'preferred date and party size if mentioned',
    },
  ],
  general: GENERAL_FIELDS,
};

export function qualificationFieldsForIndustry(
  industry: string | null | undefined
): QualificationField[] {
  const canonical = (resolveIndustryAlias(industry || 'general') ||
    'general') as CanonicalIndustry;
  return INDUSTRY_FIELDS[canonical] || GENERAL_FIELDS;
}

export function mergeKnownDetails(
  detection: LeadDetectionResult,
  extra?: Record<string, string | null | undefined>
): Record<string, string | null> {
  const known: Record<string, string | null> = {
    service: detection.service,
    budget: detection.budget,
    timeline: detection.timeline,
  };
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (typeof value === 'string' && value.trim()) {
        known[key] = value.trim();
      } else if (known[key] == null) {
        known[key] = null;
      }
    }
  }
  return known;
}

export function buildQualificationSnapshot(
  industry: string | null | undefined,
  known: Record<string, string | null | undefined>
): QualificationSnapshot {
  const fields = qualificationFieldsForIndustry(industry);
  const normalized: Record<string, string | null> = {};
  const missing: QualificationField[] = [];
  for (const field of fields) {
    const value = known[field.key];
    const present =
      typeof value === 'string' &&
      value.trim() &&
      value.toLowerCase() !== 'null';
    normalized[field.key] = present ? value.trim() : null;
    if (!present) missing.push(field);
  }

  const next = missing[0];
  return {
    known: normalized,
    missing,
    nextQuestion: next ? `Could you share ${next.promptHint}?` : null,
  };
}

/**
 * Compute a 0–100 score without inventing facts. Missing details stay
 * missing and only reduce the score; they never fabricate budget/timeline.
 */
export function computeLeadScore(input: {
  detection: LeadDetectionResult;
  known: Record<string, string | null | undefined>;
  industry?: string | null;
  customerEngaged?: boolean;
}): { numeric: number; label: LeadScoreLabel } {
  const { detection, known, industry, customerEngaged } = input;
  if (!detection.is_business_enquiry) {
    return { numeric: 0, label: 'cold' };
  }

  let score = 30;
  if (detection.intent === 'high') score += 30;
  else if (detection.intent === 'medium') score += 18;
  else if (detection.intent === 'low') score += 6;

  if (detection.service) score += 12;
  const fields = qualificationFieldsForIndustry(industry);
  const provided = fields.filter((f) => {
    const value = known[f.key];
    return typeof value === 'string' && value.trim();
  }).length;
  score += Math.min(20, provided * 5);

  if (known.budget) score += 6;
  if (known.timeline) score += 6;
  if (customerEngaged) score += 4;

  const numeric = Math.min(100, Math.max(0, Math.round(score)));
  return { numeric, label: scoreLabelFromNumeric(numeric) };
}

export function qualificationPromptHint(
  industry: string | null | undefined
): string {
  const fields = qualificationFieldsForIndustry(industry);
  const labels = fields.map((f) => f.label.toLowerCase()).join(', ');
  return `Ask at most one short, natural follow-up if needed. Relevant details for this business include: ${labels}. Do not interrogate. Skip anything the customer already answered. Unknown values must stay null.`;
}
