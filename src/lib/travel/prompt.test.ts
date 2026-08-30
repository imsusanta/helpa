import { describe, expect, it } from 'vitest';
import {
  TRAVEL_PACKAGE_SOURCE_OF_TRUTH_RULES,
  buildTravelPackagePromptBlock,
} from './prompt';
import { TOUR_PACKAGE_RETRIEVAL_UNAVAILABLE } from './types';
import { parseTravelerRequirements } from './matching';
import type { TourPackageDetail, TourPackageMatchResult } from './types';

const kashmir: TourPackageDetail = {
  id: 'pkg-a',
  account_id: 'acc-a',
  name: 'Kashmir Delight',
  destination: 'Kashmir',
  description: 'Hotel + breakfast included.',
  package_type: 'Family',
  category: 'Domestic',
  duration_days: 5,
  duration_nights: 4,
  starting_price: 27999,
  currency: 'INR',
  status: 'active',
  featured: true,
  valid_from: '2026-01-01',
  valid_until: '2026-12-31',
  booking_notes: null,
  terms_and_conditions: null,
  created_at: '',
  updated_at: '',
  itineraries: [
    {
      id: 'd3',
      account_id: 'acc-a',
      package_id: 'pkg-a',
      day_number: 3,
      title: 'Gulmarg',
      description: 'Gondola ride',
      activities: 'Gondola',
      meals: 'Breakfast',
      hotel: 'Pine View',
      overnight_location: 'Gulmarg',
      created_at: '',
      updated_at: '',
    },
  ],
  inclusions: [
    {
      id: 'i1',
      account_id: 'acc-a',
      package_id: 'pkg-a',
      item: 'Hotel and breakfast',
      created_at: '',
    },
  ],
  exclusions: [],
  hotels: [],
  pricing: [],
  departures: [],
};

describe('travel package prompt block', () => {
  it('leaves non-package questions unchanged', () => {
    const block = buildTravelPackagePromptBlock({
      matches: [],
      nearMatches: [],
      retrievalFailed: false,
      requirements: parseTravelerRequirements('What time do you open?'),
    });
    expect(block).toBe('');
  });

  it('uses the safe fallback when retrieval fails', () => {
    const block = buildTravelPackagePromptBlock({
      matches: [],
      nearMatches: [],
      retrievalFailed: true,
      requirements: parseTravelerRequirements('Kashmir package ache?'),
    });
    expect(block).toContain(TOUR_PACKAGE_RETRIEVAL_UNAVAILABLE);
    expect(block).not.toContain('Kashmir Delight');
  });

  it('says no match instead of inventing a package', () => {
    const result: TourPackageMatchResult = {
      matches: [],
      nearMatches: [],
      retrievalFailed: false,
      requirements: parseTravelerRequirements('Andaman package ache?'),
    };
    const block = buildTravelPackagePromptBlock(result);
    expect(block).toContain('No matching Tour Package was found');
    expect(block).toContain('Do not invent a package');
  });

  it('grounds a budget match in retrieved package facts only', () => {
    const result: TourPackageMatchResult = {
      matches: [
        {
          package: kashmir,
          score: 190,
          fitsBudget: true,
          reasons: ['Exact destination', 'Budget fit'],
          matchedPrice: 27999,
          matchedCurrency: 'INR',
          matchedPricing: null,
          matchedDeparture: null,
        },
      ],
      nearMatches: [],
      retrievalFailed: false,
      requirements: parseTravelerRequirements('Budget 30k, Kashmir 5 days.'),
    };
    const block = buildTravelPackagePromptBlock(result);
    expect(block).toContain('Kashmir Delight');
    expect(block).toContain('₹27,999');
    expect(block).toContain(TRAVEL_PACKAGE_SOURCE_OF_TRUTH_RULES);
    expect(block).not.toContain('estimated');
  });
});
