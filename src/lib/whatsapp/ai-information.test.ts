import { describe, expect, it } from 'vitest';
import { parseTravelerRequirements } from '@/lib/travel/matching';
import type { TourPackageMatchResult } from '@/lib/travel/types';
import {
  decideWhatsAppInformation,
  evidenceFromTravelResult,
  factsFromHospitalContext,
} from './ai-information';

describe('WhatsApp information evidence', () => {
  it('marks a travel DB outage as retrieval failure, not empty catalog', () => {
    const evidence = evidenceFromTravelResult({
      matches: [],
      nearMatches: [],
      similarMatches: [],
      retrievalFailed: true,
      requirements: parseTravelerRequirements('Kashmir package ache?'),
    });
    expect(evidence.retrievalFailed).toBe(true);
    expect(evidence.retrievalErrorSource).toBe('database');
  });

  it('keeps similar verified options for the decision engine', () => {
    const result = {
      matches: [],
      nearMatches: [],
      similarMatches: [
        {
          package: { name: 'Sikkim Escape', destination: 'Sikkim', starting_price: 14500, currency: 'INR' },
          matchedPrice: 14500,
          matchedCurrency: 'INR',
        },
      ],
      retrievalFailed: false,
      requirements: parseTravelerRequirements(
        '₹15,000-এর মধ্যে Darjeeling package আছে?'
      ),
    } as unknown as TourPackageMatchResult;

    const decision = decideWhatsAppInformation({
      message: '₹15,000-এর মধ্যে Darjeeling package আছে?',
      industry: 'travel',
      travelResult: result,
    });
    expect(decision.outcome).toBe('similar_suggestion');
    expect(decision.similarSuggestions[0]?.destination).toBe('Sikkim');
  });

  it('does not treat a hospital context blob as a verified fee', () => {
    expect(
      factsFromHospitalContext('Registered Patients under this number:\n', 'Dr. Roy fee koto?')
    ).toEqual([]);
  });

  it('extracts a named doctor fee from hospital context', () => {
    const facts = factsFromHospitalContext(
      'Available Doctors & Clinic Schedules:\n- Dr. Rao (Cardiology - General): Fee: ₹500, Working Days: Mon\n',
      'Dr. Rao consultation fee koto?'
    );
    expect(facts.some((fact) => fact.field === 'fee' && fact.value.includes('500'))).toBe(
      true
    );
  });

  it('does not mark a successful travel lookup as system error when KB is down', () => {
    const decision = decideWhatsAppInformation({
      message: 'Kashmir package ache?',
      industry: 'travel',
      knowledgeRetrievalFailed: true,
      travelResult: {
        matches: [],
        nearMatches: [],
        similarMatches: [],
        retrievalFailed: false,
        requirements: parseTravelerRequirements('Kashmir package ache?'),
      },
    });
    expect(decision.outcome).toBe('safe_fallback');
    expect(decision.outcome).not.toBe('system_error');
  });
});
