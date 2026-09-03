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
  cover_image_url: null,
  price_type: 'Per Person',
  min_people: 2,
  max_people: 20,
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
      similarMatches: [],
      retrievalFailed: false,
      requirements: parseTravelerRequirements('What time do you open?'),
    });
    expect(block).toBe('');
  });

  it('uses the safe fallback when retrieval fails', () => {
    const block = buildTravelPackagePromptBlock({
      matches: [],
      nearMatches: [],
      similarMatches: [],
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
      similarMatches: [],
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
      similarMatches: [],
      retrievalFailed: false,
      requirements: parseTravelerRequirements('Budget 30k, Kashmir 5 days.'),
    };
    const block = buildTravelPackagePromptBlock(result);
    expect(block).toContain('Kashmir Delight');
    expect(block).toContain('₹27,999');
    expect(block).toContain(TRAVEL_PACKAGE_SOURCE_OF_TRUTH_RULES);
    expect(block).not.toContain('estimated');
  });

  it('suggests only verified similar packages when the destination is missing', () => {
    const sikkim: TourPackageDetail = {
      ...kashmir,
      id: 'pkg-s',
      name: 'Sikkim Escape',
      destination: 'Sikkim',
      starting_price: 14500,
    };
    const result: TourPackageMatchResult = {
      matches: [],
      nearMatches: [],
      similarMatches: [
        {
          package: sikkim,
          score: 25,
          fitsBudget: true,
          reasons: ['Similar verified option'],
          matchedPrice: 14500,
          matchedCurrency: 'INR',
          matchedPricing: null,
          matchedDeparture: null,
        },
      ],
      retrievalFailed: false,
      requirements: parseTravelerRequirements(
        '₹15,000-এর মধ্যে Darjeeling package আছে?'
      ),
    };
    const block = buildTravelPackagePromptBlock(result);
    expect(block).toContain('Verified similar options');
    expect(block).toContain('Sikkim');
    expect(block).toContain('₹14,500');
    expect(block).not.toContain('Kashmir Delight');
  });
});
