import { describe, expect, it } from 'vitest';
import { tourPackageToProposalPrefill } from './proposal-adapter';
import type { TourPackageDetail } from './types';

describe('trip proposal package prefill', () => {
  it('copies only stored package fields into the existing proposal shape', () => {
    const pkg: TourPackageDetail = {
      id: '1',
      account_id: 'acc',
      name: 'Kashmir Delight',
      destination: 'Kashmir',
      description: 'Scenic valley',
      package_type: 'Family',
      category: 'Domestic',
      duration_days: 5,
      duration_nights: 4,
      starting_price: 27999,
      currency: 'INR',
      status: 'active',
      featured: false,
      valid_from: null,
      valid_until: null,
      booking_notes: null,
      terms_and_conditions: null,
      cover_image_url: null,
      price_type: 'Per Person',
      created_at: '',
      updated_at: '',
      itineraries: [
        {
          id: 'd1',
          account_id: 'acc',
          package_id: '1',
          day_number: 1,
          title: 'Arrival',
          description: 'Srinagar',
          activities: 'Shikara',
          meals: 'Dinner',
          hotel: 'Dal View',
          overnight_location: 'Srinagar',
          created_at: '',
          updated_at: '',
        },
      ],
      inclusions: [
        {
          id: 'i',
          account_id: 'acc',
          package_id: '1',
          item: 'Breakfast',
          created_at: '',
        },
      ],
      exclusions: [
        {
          id: 'e',
          account_id: 'acc',
          package_id: '1',
          item: 'Airfare',
          created_at: '',
        },
      ],
      hotels: [
        {
          id: 'h',
          account_id: 'acc',
          package_id: '1',
          city: 'Srinagar',
          hotel_name: 'Dal View',
          star_category: '4 Star',
          room_type: 'Deluxe',
          meal_plan: 'Breakfast',
          notes: null,
          created_at: '',
          updated_at: '',
        },
      ],
      pricing: [],
      departures: [],
    };

    const prefill = tourPackageToProposalPrefill(pkg);
    expect(prefill.proposal_title).toBe('Kashmir Delight');
    expect(prefill.destination).toBe('Kashmir');
    expect(prefill.duration_label).toBe('5 Days / 4 Nights');
    expect(prefill.itinerary[0]?.title).toBe('Arrival');
    expect(prefill.inclusions).toEqual(['Breakfast']);
    expect(prefill.exclusions).toEqual(['Airfare']);
    expect(prefill.items[0]?.unit_price).toBe(27999);
  });
});
