import type { TourPackageDetail } from './types';

export interface TripProposalPrefill {
  proposal_title: string;
  destination: string;
  duration_label: string;
  trip_type: string;
  hotel_category: string;
  meal_plan: string;
  itinerary: Array<{ day: number; title: string; description: string }>;
  inclusions: string[];
  exclusions: string[];
  items: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    category: string;
  }>;
}

export function tourPackageToProposalPrefill(
  pkg: TourPackageDetail
): TripProposalPrefill {
  const hotel = pkg.hotels[0];
  const price = pkg.starting_price ?? pkg.pricing[0]?.price ?? 0;
  return {
    proposal_title: pkg.name,
    destination: pkg.destination,
    duration_label: `${pkg.duration_days} Days / ${pkg.duration_nights} Nights`,
    trip_type: pkg.package_type || 'Family Holiday',
    hotel_category: hotel?.star_category || '4 Star',
    meal_plan: hotel?.meal_plan || 'Breakfast',
    itinerary:
      pkg.itineraries.length > 0
        ? pkg.itineraries.map((day) => ({
            day: day.day_number,
            title: day.title || `Day ${day.day_number}`,
            description: [day.description, day.activities]
              .filter(Boolean)
              .join(' '),
          }))
        : [
            {
              day: 1,
              title: 'Arrival',
              description: pkg.description || 'Arrival and check-in.',
            },
          ],
    inclusions:
      pkg.inclusions.length > 0
        ? pkg.inclusions.map((row) => row.item)
        : ['Hotel accommodation'],
    exclusions:
      pkg.exclusions.length > 0
        ? pkg.exclusions.map((row) => row.item)
        : ['Personal expenses'],
    items: [
      {
        description: pkg.name,
        quantity: 1,
        unit_price: Number(price) || 0,
        category: 'Other',
      },
      ...pkg.hotels.map((row) => ({
        description: `${row.hotel_name}${row.city ? ` — ${row.city}` : ''}`,
        quantity: 1,
        unit_price: 0,
        category: 'Hotel',
      })),
    ],
  };
}
