export const TOUR_PACKAGE_STATUSES = ['active', 'inactive'] as const;
export const TOUR_DEPARTURE_STATUSES = [
  'open',
  'sold_out',
  'cancelled',
  'closed',
] as const;

export const TOUR_PACKAGE_TYPES = [
  'Family',
  'Honeymoon',
  'Group',
  'Adventure',
  'Leisure',
  'Beach',
  'Pilgrimage',
  'Corporate',
  'Custom',
] as const;

export const TOUR_PACKAGE_CATEGORIES = [
  'Domestic',
  'International',
  'Weekend',
  'Luxury',
  'Budget',
  'Custom',
] as const;

export const TOUR_PACKAGE_CURRENCIES = [
  'INR',
  'USD',
  'EUR',
  'GBP',
  'BDT',
  'AED',
] as const;

export const TOUR_PRICE_TYPES = [
  'Per Person',
  'Per Couple',
  'Per Package',
  'Per Night',
] as const;

export type TourPackageStatus = (typeof TOUR_PACKAGE_STATUSES)[number];
export type TourDepartureStatus = (typeof TOUR_DEPARTURE_STATUSES)[number];

export interface TourPackage {
  id: string;
  account_id: string;
  name: string;
  destination: string;
  description: string | null;
  package_type: string | null;
  category: string | null;
  duration_days: number;
  duration_nights: number;
  starting_price: number | null;
  currency: string;
  status: TourPackageStatus;
  featured: boolean;
  valid_from: string | null;
  valid_until: string | null;
  booking_notes: string | null;
  terms_and_conditions: string | null;
  cover_image_url: string | null;
  price_type: string | null;
  min_people: number | null;
  max_people: number | null;
  created_at: string;
  updated_at: string;
}

export interface TourPackageItinerary {
  id: string;
  account_id: string;
  package_id: string;
  day_number: number;
  title: string | null;
  description: string | null;
  activities: string | null;
  meals: string | null;
  hotel: string | null;
  overnight_location: string | null;
  created_at: string;
  updated_at: string;
}

export interface TourPackageInclusion {
  id: string;
  account_id: string;
  package_id: string;
  item: string;
  created_at: string;
}

export interface TourPackageExclusion {
  id: string;
  account_id: string;
  package_id: string;
  item: string;
  created_at: string;
}

export interface TourPackageHotel {
  id: string;
  account_id: string;
  package_id: string;
  city: string | null;
  hotel_name: string;
  star_category: string | null;
  room_type: string | null;
  meal_plan: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface TourPackagePricing {
  id: string;
  account_id: string;
  package_id: string;
  pricing_name: string | null;
  adults: number;
  children: number;
  occupancy_type: string | null;
  price: number;
  currency: string;
  extra_bed: number | null;
  valid_from: string | null;
  valid_until: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface TourPackageDeparture {
  id: string;
  account_id: string;
  package_id: string;
  departure_date: string;
  return_date: string | null;
  total_seats: number | null;
  available_seats: number | null;
  price: number | null;
  currency: string;
  status: TourDepartureStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface TourPackageDetail extends TourPackage {
  itineraries: TourPackageItinerary[];
  inclusions: TourPackageInclusion[];
  exclusions: TourPackageExclusion[];
  hotels: TourPackageHotel[];
  pricing: TourPackagePricing[];
  departures: TourPackageDeparture[];
}

export interface TourPackageWriteInput {
  name: string;
  destination: string;
  description?: string | null;
  package_type?: string | null;
  category?: string | null;
  duration_days?: number;
  duration_nights?: number;
  starting_price?: number | null;
  currency?: string;
  status?: TourPackageStatus;
  featured?: boolean;
  valid_from?: string | null;
  valid_until?: string | null;
  booking_notes?: string | null;
  terms_and_conditions?: string | null;
  cover_image_url?: string | null;
  price_type?: string | null;
  min_people?: number | null;
  max_people?: number | null;
  itineraries?: Array<{
    day_number: number;
    title?: string | null;
    description?: string | null;
    activities?: string | null;
    meals?: string | null;
    hotel?: string | null;
    overnight_location?: string | null;
  }>;
  inclusions?: Array<{ item: string }>;
  exclusions?: Array<{ item: string }>;
  hotels?: Array<{
    city?: string | null;
    hotel_name: string;
    star_category?: string | null;
    room_type?: string | null;
    meal_plan?: string | null;
    notes?: string | null;
  }>;
  pricing?: Array<{
    pricing_name?: string | null;
    adults?: number;
    children?: number;
    occupancy_type?: string | null;
    price: number;
    currency?: string;
    extra_bed?: number | null;
    valid_from?: string | null;
    valid_until?: string | null;
    notes?: string | null;
  }>;
  departures?: Array<{
    departure_date: string;
    return_date?: string | null;
    total_seats?: number | null;
    available_seats?: number | null;
    price?: number | null;
    currency?: string;
    status?: TourDepartureStatus;
    notes?: string | null;
  }>;
}

export interface TravelerRequirements {
  destination: string | null;
  budget: number | null;
  durationDays: number | null;
  durationNights: number | null;
  adults: number | null;
  children: number | null;
  packageType: string | null;
  category: string | null;
  travelMonth: number | null;
  travelDate: string | null;
  itineraryDay: number | null;
  inclusionQuery: string | null;
  query: string;
  packageIntent: boolean;
}

export interface RankedTourPackage {
  package: TourPackageDetail;
  score: number;
  fitsBudget: boolean;
  reasons: string[];
  matchedPrice: number | null;
  matchedCurrency: string | null;
  matchedPricing: TourPackagePricing | null;
  matchedDeparture: TourPackageDeparture | null;
}

export interface TourPackageMatchResult {
  matches: RankedTourPackage[];
  nearMatches: RankedTourPackage[];
  retrievalFailed: boolean;
  requirements: TravelerRequirements;
}

export const TOUR_PACKAGE_RETRIEVAL_UNAVAILABLE =
  "I'm unable to check the latest package details right now. Let me verify that for you.";
