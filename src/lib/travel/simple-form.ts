import { TOUR_PRICE_TYPES, type TourPackageWriteInput } from './types';

export const SIMPLE_DESCRIPTION_MAX = 200;
export const DEFAULT_MIN_PEOPLE = 2;
export const DEFAULT_MAX_PEOPLE = 20;

export interface SimpleTourPackageForm {
  name: string;
  destination: string;
  description: string;
  duration_days: number;
  duration_nights: number;
  starting_price: number | null;
  currency: string;
  price_type: string;
  cover_image_url: string | null;
  valid_from: string;
  valid_until: string;
  min_people: number | null;
  max_people: number | null;
  itineraries: Array<{
    day_number: number;
    title: string;
    description: string;
  }>;
}

export function emptySimpleTourPackageForm(): SimpleTourPackageForm {
  return {
    name: '',
    destination: '',
    description: '',
    duration_days: 5,
    duration_nights: 4,
    starting_price: null,
    currency: 'INR',
    price_type: 'Per Person',
    cover_image_url: null,
    valid_from: '',
    valid_until: '',
    min_people: DEFAULT_MIN_PEOPLE,
    max_people: DEFAULT_MAX_PEOPLE,
    itineraries: [],
  };
}

export function occupancyForPriceType(priceType: string): {
  adults: number;
  children: number;
  occupancy_type: string;
} {
  switch (priceType) {
    case 'Per Couple':
      return { adults: 2, children: 0, occupancy_type: 'Double' };
    case 'Per Package':
      return { adults: 2, children: 0, occupancy_type: 'Package' };
    case 'Per Night':
      return { adults: 1, children: 0, occupancy_type: 'Night' };
    default:
      return { adults: 1, children: 0, occupancy_type: 'Single' };
  }
}

export function validateSimpleTourPackageForm(
  form: SimpleTourPackageForm
): string | null {
  if (!form.name.trim()) return 'Package name is required';
  if (!form.destination.trim()) return 'Destination is required';
  if (!Number.isFinite(form.duration_days) || form.duration_days < 1) {
    return 'Duration is required';
  }
  if (form.starting_price == null || !Number.isFinite(form.starting_price)) {
    return 'Price is required';
  }
  if (form.starting_price <= 0) return 'Price must be greater than 0';
  if (
    !form.price_type.trim() ||
    !TOUR_PRICE_TYPES.includes(form.price_type as never)
  ) {
    return 'Price type is required';
  }
  if (!form.description.trim()) return 'Short description is required';
  if (form.description.trim().length > SIMPLE_DESCRIPTION_MAX) {
    return `Short description must be ${SIMPLE_DESCRIPTION_MAX} characters or fewer`;
  }
  const validFrom = form.valid_from.trim();
  const validUntil = form.valid_until.trim();
  if (validFrom && validUntil && validUntil < validFrom) {
    return 'Available until must be on or after available from';
  }
  if (form.min_people != null) {
    if (!Number.isFinite(form.min_people) || form.min_people < 1) {
      return 'Minimum people must be at least 1';
    }
  }
  if (form.max_people != null) {
    if (!Number.isFinite(form.max_people) || form.max_people < 1) {
      return 'Maximum people must be at least 1';
    }
  }
  if (
    form.min_people != null &&
    form.max_people != null &&
    form.max_people < form.min_people
  ) {
    return 'Maximum people must be at least the minimum';
  }
  return null;
}

export function simpleFormToWriteInput(
  form: SimpleTourPackageForm
): TourPackageWriteInput {
  const occupancy = occupancyForPriceType(form.price_type);
  const price = Number(form.starting_price);
  return {
    name: form.name.trim(),
    destination: form.destination.trim(),
    description: form.description.trim(),
    duration_days: form.duration_days,
    duration_nights: Math.max(0, form.duration_nights),
    starting_price: price,
    currency: form.currency || 'INR',
    price_type: form.price_type,
    price_for: form.price_type,
    cover_image_url: form.cover_image_url,
    image_url: form.cover_image_url,
    valid_from: form.valid_from.trim() || null,
    valid_until: form.valid_until.trim() || null,
    min_people: form.min_people,
    max_people: form.max_people,
    itineraries: form.itineraries
      .filter((day) => day.title.trim() || day.description.trim())
      .map((day, index) => ({
        day_number: index + 1,
        title: day.title.trim() || `Day ${index + 1}`,
        description: day.description.trim() || null,
      })),
    pricing: [
      {
        pricing_name: form.price_type,
        price,
        currency: form.currency || 'INR',
        ...occupancy,
      },
    ],
  };
}
