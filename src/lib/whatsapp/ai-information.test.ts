import { describe, expect, it } from 'vitest';
import { parseTravelerRequirements } from '@/lib/travel/matching';
import type { TourPackageMatchResult } from '@/lib/travel/types';
import {
  decideWhatsAppInformation,
  evidenceFromTravelResult,
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
});
