import { describe, expect, it } from 'vitest';
import {
  detectTourPackageIntent,
  formatMoney,
  isDepartureBookable,
  isPackageCurrentlyActive,
  parseBudgetAmount,
  parseDestination,
  parseDurationDays,
  parseTravelDate,
  parseTravelerCounts,
  parseTravelerRequirements,
  rankTourPackages,
  resolvePackagePrice,
} from './matching';
import type { TourPackageDetail } from './types';

function pkg(
  overrides: Partial<TourPackageDetail> &
    Pick<TourPackageDetail, 'id' | 'account_id' | 'name' | 'destination'>
): TourPackageDetail {
  return {
    description: null,
    package_type: 'Family',
    category: 'Domestic',
    duration_days: 5,
    duration_nights: 4,
    starting_price: 25000,
    currency: 'INR',
    status: 'active',
    featured: false,
    valid_from: '2026-01-01',
    valid_until: '2026-12-31',
    booking_notes: null,
    terms_and_conditions: null,
    created_at: '2026-08-01T00:00:00.000Z',
    updated_at: '2026-08-01T00:00:00.000Z',
    itineraries: [],
    inclusions: [{ id: 'i1', account_id: overrides.account_id, package_id: overrides.id, item: 'Hotel', created_at: '' }],
    exclusions: [],
    hotels: [
      {
        id: 'h1',
        account_id: overrides.account_id,
        package_id: overrides.id,
        city: overrides.destination,
        hotel_name: 'Pine View',
        star_category: '3 Star',
        room_type: 'Deluxe',
        meal_plan: 'Breakfast',
        notes: null,
        created_at: '',
        updated_at: '',
      },
    ],
    pricing: [],
    departures: [],
    ...overrides,
  };
}

describe('traveler requirement parsing', () => {
  it('detects package intent for Bangla and English queries', () => {
    expect(detectTourPackageIntent('Kashmir package ache?')).toBe(true);
    expect(detectTourPackageIntent('Amar budget 30,000')).toBe(true);
    expect(detectTourPackageIntent('What are your clinic hours?')).toBe(false);
  });

  it('parses budget, destination, and duration from CASE 2', () => {
    const req = parseTravelerRequirements('Budget 30k, Kashmir 5 days.');
    expect(req.destination?.toLowerCase()).toBe('kashmir');
    expect(req.budget).toBe(30000);
    expect(req.durationDays).toBe(5);
    expect(parseBudgetAmount('Amar budget 30,000')).toBe(30000);
    expect(parseBudgetAmount('My budget is ₹30,000.')).toBe(30000);
    expect(parseBudgetAmount('budget 50k')).toBe(50000);
    expect(parseDurationDays('4 diner package chai').days).toBe(4);
  });

  it('parses September 15 availability and occupancy', () => {
    const when = parseTravelDate('September 15 e Kashmir available?', new Date('2026-08-30'));
    expect(when.date).toBe('2026-09-15');
    expect(parseDestination('September 15 e Kashmir available?')?.toLowerCase()).toBe(
      'kashmir'
    );
    expect(parseTravelerCounts('2 adults 1 child er jonno koto?')).toEqual({
      adults: 2,
      children: 1,
    });
    expect(parseTravelerRequirements('Day 3 e ki ache?').itineraryDay).toBe(3);
    expect(parseTravelerRequirements('Family trip chai').packageType).toBe('Family');
    expect(parseTravelerRequirements('Beach trip').category).toBe('Beach');
  });
});

describe('budget and destination matching', () => {
  const workspaceA = [
    pkg({
      id: 'a-cheap',
      account_id: 'travel-a',
      name: 'Kashmir Delight',
      destination: 'Kashmir',
      starting_price: 25000,
      duration_days: 5,
    }),
    pkg({
      id: 'a-costly',
      account_id: 'travel-a',
      name: 'Kashmir Premium',
      destination: 'Kashmir',
      starting_price: 45000,
      duration_days: 5,
    }),
    pkg({
      id: 'a-darj',
      account_id: 'travel-a',
      name: 'Darjeeling Delight',
      destination: 'Darjeeling',
      starting_price: 18000,
    }),
  ];

  it('CASE 1/2: returns only matching destination packages that fit budget', () => {
    const req = parseTravelerRequirements('Budget 30k, Kashmir 5 days.');
    const { matches, nearMatches } = rankTourPackages(workspaceA, req);
    expect(matches.map((row) => row.package.name)).toEqual(['Kashmir Delight']);
    expect(nearMatches.map((row) => row.package.name)).toEqual(['Kashmir Premium']);
    expect(matches[0]?.fitsBudget).toBe(true);
  });

  it('does not recommend the over-budget package as a fit', () => {
    const req = parseTravelerRequirements('My budget is ₹30,000.');
    req.destination = 'Kashmir';
    const { matches } = rankTourPackages(workspaceA, req);
    expect(matches.some((row) => row.package.starting_price === 45000)).toBe(
      false
    );
  });

  it('CASE 6: invents nothing when destination has no package', () => {
    const req = parseTravelerRequirements('Andaman package ache?');
    const { matches, nearMatches } = rankTourPackages(workspaceA, req);
    expect(matches).toEqual([]);
    expect(nearMatches).toEqual([]);
  });

  it('CASE 3: uses departure availability for a requested date', () => {
    const withDeparture = [
      pkg({
        id: 'a-cheap',
        account_id: 'travel-a',
        name: 'Kashmir Delight',
        destination: 'Kashmir',
        departures: [
          {
            id: 'd1',
            account_id: 'travel-a',
            package_id: 'a-cheap',
            departure_date: '2026-09-15',
            return_date: '2026-09-19',
            total_seats: 20,
            available_seats: 6,
            price: 25999,
            currency: 'INR',
            status: 'open',
            notes: null,
            created_at: '',
            updated_at: '',
          },
        ],
      }),
    ];
    const req = parseTravelerRequirements(
      'September 15 e Kashmir available?',
      new Date('2026-08-30')
    );
    const { matches } = rankTourPackages(withDeparture, req);
    expect(matches[0]?.matchedDeparture?.departure_date).toBe('2026-09-15');
    expect(matches[0]?.reasons).toContain('Date availability');
  });

  it('CASE 4: uses occupancy pricing when 2 adults and 1 child are requested', () => {
    const priced = pkg({
      id: 'a-cheap',
      account_id: 'travel-a',
      name: 'Kashmir Delight',
      destination: 'Kashmir',
      starting_price: 25000,
      pricing: [
        {
          id: 'p1',
          account_id: 'travel-a',
          package_id: 'a-cheap',
          pricing_name: '2A1C',
          adults: 2,
          children: 1,
          occupancy_type: 'Triple',
          price: 62000,
          currency: 'INR',
          extra_bed: null,
          valid_from: null,
          valid_until: null,
          notes: null,
          created_at: '',
          updated_at: '',
        },
      ],
    });
    const req = parseTravelerRequirements('2 adults 1 child er jonno koto?');
    const resolved = resolvePackagePrice(priced, req);
    expect(resolved.price).toBe(62000);
    expect(resolved.pricing?.adults).toBe(2);
    expect(resolved.pricing?.children).toBe(1);
  });

  it('CASE 5: keeps itinerary days available for lookup', () => {
    const withItinerary = pkg({
      id: 'a-cheap',
      account_id: 'travel-a',
      name: 'Kashmir Delight',
      destination: 'Kashmir',
      itineraries: [
        {
          id: 'it3',
          account_id: 'travel-a',
          package_id: 'a-cheap',
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
    });
    expect(
      withItinerary.itineraries.find((day) => day.day_number === 3)?.title
    ).toBe('Gulmarg');
  });

  it('skips inactive, expired, and sold-out departures', () => {
    expect(
      isPackageCurrentlyActive(
        pkg({
          id: 'x',
          account_id: 'a',
          name: 'Old',
          destination: 'Kashmir',
          status: 'inactive',
        })
      )
    ).toBe(false);
    expect(
      isPackageCurrentlyActive(
        pkg({
          id: 'x',
          account_id: 'a',
          name: 'Expired',
          destination: 'Kashmir',
          valid_until: '2025-01-01',
        }),
        '2026-08-30'
      )
    ).toBe(false);
    expect(
      isDepartureBookable({
        id: 'd',
        account_id: 'a',
        package_id: 'x',
        departure_date: '2026-09-15',
        return_date: null,
        total_seats: 10,
        available_seats: 0,
        price: 1,
        currency: 'INR',
        status: 'sold_out',
        notes: null,
        created_at: '',
        updated_at: '',
      })
    ).toBe(false);
  });

  it('formats prices without inventing a value', () => {
    expect(formatMoney(27999, 'INR')).toBe('₹27,999');
    expect(formatMoney(null)).toBeNull();
  });
});
