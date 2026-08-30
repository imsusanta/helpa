import {
  TOUR_PRICE_TYPES,
  type TourPackageWriteInput,
} from './types';

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
  if (!form.price_type.trim() || !TOUR_PRICE_TYPES.includes(form.price_type as never)) {
    return 'Price type is required';
  }
  if (!form.description.trim()) return 'Short description is required';
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
    cover_image_url: form.cover_image_url,
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
