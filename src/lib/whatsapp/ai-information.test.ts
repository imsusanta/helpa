import { describe, expect, it } from 'vitest';
import { parseTravelerRequirements } from '@/lib/travel/matching';
import type { TourPackageMatchResult } from '@/lib/travel/types';
import {
  decideWhatsAppInformation,
  evidenceFromTravelResult,
  factsFromHospitalContext,
  factsFromHospitalDoctors,
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

  it('answers a named doctor fee from structured hospital rows', () => {
    const decision = decideWhatsAppInformation({
      message: 'Dr. Rao consultation fee koto?',
      industry: 'health',
      hospitalDoctors: [
        {
          name: 'Rao',
          department: 'Cardiology',
          consultation_fee: 500,
        },
      ],
    });
    expect(decision.outcome).toBe('direct_answer');
    expect(decision.answerSource).toBe('database');
    expect(decision.resolvedFacts.some((fact) => fact.value.includes('500'))).toBe(
      true
    );
  });

  it('does not invent a fee when the doctor row has no consultation fee', () => {
    const decision = decideWhatsAppInformation({
      message: 'Dr. Rao fee koto?',
      industry: 'health',
      hospitalDoctors: [{ name: 'Rao', department: 'Cardiology', consultation_fee: 0 }],
    });
    expect(decision.outcome).toBe('safe_fallback');
    expect(decision.handoffRequired).toBe(true);
    expect(factsFromHospitalDoctors([{ name: 'Rao', consultation_fee: 0 }], 'Dr. Rao fee koto?')).toEqual(
      expect.not.arrayContaining([expect.objectContaining({ field: 'fee' })])
    );
  });

  it('answers a coaching course fee from the courses table', () => {
    const decision = decideWhatsAppInformation({
      message: 'NEET course fee koto?',
      industry: 'coaching',
      coachingCourses: [{ name: 'NEET Crash', fee: 12000, duration: '6 months' }],
    });
    expect(decision.outcome).toBe('direct_answer');
    expect(decision.answerSource).toBe('database');
    expect(
      decision.resolvedFacts.some((fact) => fact.field === 'fee' && fact.value.includes('12,000'))
    ).toBe(true);
  });

  it('ignores a bot-invented price in conversation history', () => {
    const decision = decideWhatsAppInformation({
      message: 'Platinum card koto?',
      industry: 'coaching',
      coachingCourses: [],
      conversationMessages: [
        { sender_type: 'bot', content_text: 'Platinum card is ₹999' },
        { sender_type: 'customer', content_text: 'Platinum card koto?' },
      ],
    });
    expect(decision.outcome).toBe('safe_fallback');
    expect(decision.resolvedFacts).toEqual([]);
  });

  it('uses a staff-confirmed price only when the database has no fee', () => {
    const decision = decideWhatsAppInformation({
      message: 'Platinum card koto?',
      industry: 'coaching',
      coachingCourses: [],
      conversationMessages: [
        { sender_type: 'agent', content_text: 'Platinum card is ₹1,500' },
      ],
    });
    expect(decision.outcome).toBe('direct_answer');
    expect(decision.answerSource).toBe('conversation');
    expect(decision.resolvedFacts[0]?.value).toContain('1,500');
  });

  it('treats a hospital roster outage as system error, not missing data', () => {
    const decision = decideWhatsAppInformation({
      message: 'Dr. Rao fee koto?',
      industry: 'health',
      hospitalLookupFailed: true,
    });
    expect(decision.outcome).toBe('system_error');
    expect(decision.fallbackMessage).toMatch(/verify|confirm/i);
  });
});
