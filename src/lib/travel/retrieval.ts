import { logger } from '@/lib/observability/logger';
import type { AdminClient } from '@/lib/db/server';
import {
  isPackageCurrentlyActive,
  parseTravelerRequirements,
  rankTourPackages,
} from './matching';
import type {
  RankedTourPackage,
  TourPackage,
  TourPackageDeparture,
  TourPackageDetail,
  TourPackageExclusion,
  TourPackageHotel,
  TourPackageInclusion,
  TourPackageItinerary,
  TourPackageMatchResult,
  TourPackagePricing,
  TourPackageWriteInput,
  TravelerRequirements,
} from './types';

const CHILD_TABLES = {
  itineraries: 'tour_package_itineraries',
  inclusions: 'tour_package_inclusions',
  exclusions: 'tour_package_exclusions',
  hotels: 'tour_package_hotels',
  pricing: 'tour_package_pricing',
  departures: 'tour_package_departures',
} as const;

function asNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function mapPackage(row: Record<string, unknown>): TourPackage {
  return {
    id: String(row.id),
    account_id: String(row.account_id),
    name: String(row.name || ''),
    destination: String(row.destination || ''),
    description: (row.description as string | null) ?? null,
    package_type: (row.package_type as string | null) ?? null,
    category: (row.category as string | null) ?? null,
    duration_days: Number(row.duration_days || 1),
    duration_nights: Number(row.duration_nights || 0),
    starting_price: asNumber(row.starting_price),
    currency: String(row.currency || 'INR'),
    status: row.status === 'inactive' ? 'inactive' : 'active',
    featured: Boolean(row.featured),
    valid_from: (row.valid_from as string | null) ?? null,
    valid_until: (row.valid_until as string | null) ?? null,
    booking_notes: (row.booking_notes as string | null) ?? null,
    terms_and_conditions: (row.terms_and_conditions as string | null) ?? null,
    cover_image_url: (row.cover_image_url as string | null) ?? null,
    price_type: (row.price_type as string | null) ?? null,
    min_people: asNumber(row.min_people),
    max_people: asNumber(row.max_people),
    created_at: String(row.created_at || ''),
    updated_at: String(row.updated_at || ''),
  };
}

function emptyDetail(pkg: TourPackage): TourPackageDetail {
  return {
    ...pkg,
    itineraries: [],
    inclusions: [],
    exclusions: [],
    hotels: [],
    pricing: [],
    departures: [],
  };
}

export function assertSameAccount(
  accountId: string,
  rowAccountId: string | null | undefined
): boolean {
  return Boolean(rowAccountId && rowAccountId === accountId);
}

export async function listTourPackages(
  db: AdminClient,
  accountId: string,
  filters?: {
    search?: string;
    destination?: string;
    status?: string;
    packageType?: string;
    limit?: number;
  }
): Promise<TourPackage[]> {
  let query = db
    .from('tour_packages')
    .select('*')
    .eq('account_id', accountId)
    .order('featured', { ascending: false })
    .order('updated_at', { ascending: false });

  if (filters?.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  }
  if (filters?.destination?.trim()) {
    query = query.ilike('destination', `%${filters.destination.trim()}%`);
  }
  if (filters?.packageType?.trim()) {
    query = query.ilike('package_type', `%${filters.packageType.trim()}%`);
  }
  if (filters?.search?.trim()) {
    const term = filters.search.trim().replace(/[%_]/g, ' ');
    query = query.or(
      `name.ilike.%${term}%,destination.ilike.%${term}%,description.ilike.%${term}%,package_type.ilike.%${term}%,category.ilike.%${term}%`
    );
  }
  if (filters?.limit) {
    query = query.limit(filters.limit);
  }

  const { data, error } = await query;
  if (error) {
    logger.error('Tour package list failed', {
      component: 'tour-packages',
      accountId,
      error: error.message,
    });
    throw new Error('TOUR_PACKAGES_LIST_FAILED');
  }

  return ((data || []) as Record<string, unknown>[])
    .filter((row) => assertSameAccount(accountId, String(row.account_id)))
    .map(mapPackage);
}

async function loadChildren(
  db: AdminClient,
  accountId: string,
  packageIds: string[]
): Promise<{
  itineraries: TourPackageItinerary[];
  inclusions: TourPackageInclusion[];
  exclusions: TourPackageExclusion[];
  hotels: TourPackageHotel[];
  pricing: TourPackagePricing[];
  departures: TourPackageDeparture[];
}> {
  if (packageIds.length === 0) {
    return {
      itineraries: [],
      inclusions: [],
      exclusions: [],
      hotels: [],
      pricing: [],
      departures: [],
    };
  }

  const [itineraries, inclusions, exclusions, hotels, pricing, departures] =
    await Promise.all([
      db
        .from(CHILD_TABLES.itineraries)
        .select('*')
        .eq('account_id', accountId)
        .in('package_id', packageIds)
        .order('day_number', { ascending: true }),
      db
        .from(CHILD_TABLES.inclusions)
        .select('*')
        .eq('account_id', accountId)
        .in('package_id', packageIds),
      db
        .from(CHILD_TABLES.exclusions)
        .select('*')
        .eq('account_id', accountId)
        .in('package_id', packageIds),
      db
        .from(CHILD_TABLES.hotels)
        .select('*')
        .eq('account_id', accountId)
        .in('package_id', packageIds),
      db
        .from(CHILD_TABLES.pricing)
        .select('*')
        .eq('account_id', accountId)
        .in('package_id', packageIds),
      db
        .from(CHILD_TABLES.departures)
        .select('*')
        .eq('account_id', accountId)
        .in('package_id', packageIds)
        .order('departure_date', { ascending: true }),
    ]);

  const firstError = [
    itineraries.error,
    inclusions.error,
    exclusions.error,
    hotels.error,
    pricing.error,
    departures.error,
  ].find(Boolean);

  if (firstError) {
    logger.error('Tour package children load failed', {
      component: 'tour-packages',
      accountId,
      error: firstError.message,
    });
    throw new Error('TOUR_PACKAGES_CHILDREN_FAILED');
  }

  const scoped = <T extends { account_id?: string; package_id?: string }>(
    rows: T[] | null
  ) =>
    (rows || []).filter(
      (row) =>
        assertSameAccount(accountId, row.account_id) &&
        packageIds.includes(String(row.package_id))
    );

  return {
    itineraries: scoped(itineraries.data as TourPackageItinerary[]),
    inclusions: scoped(inclusions.data as TourPackageInclusion[]),
    exclusions: scoped(exclusions.data as TourPackageExclusion[]),
    hotels: scoped(hotels.data as TourPackageHotel[]),
    pricing: scoped(
      ((pricing.data || []) as Record<string, unknown>[]).map((row) => ({
        ...(row as unknown as TourPackagePricing),
        price: Number(row.price),
        extra_bed: asNumber(row.extra_bed),
      }))
    ),
    departures: scoped(
      ((departures.data || []) as Record<string, unknown>[]).map((row) => ({
        ...(row as unknown as TourPackageDeparture),
        price: asNumber(row.price),
      }))
    ),
  };
}

export async function getTourPackageDetail(
  db: AdminClient,
  accountId: string,
  packageId: string
): Promise<TourPackageDetail | null> {
  const { data, error } = await db
    .from('tour_packages')
    .select('*')
    .eq('account_id', accountId)
    .eq('id', packageId)
    .maybeSingle();

  if (error) {
    logger.error('Tour package get failed', {
      component: 'tour-packages',
      accountId,
      error: error.message,
    });
    throw new Error('TOUR_PACKAGE_GET_FAILED');
  }
  if (!data || !assertSameAccount(accountId, String(data.account_id))) {
    return null;
  }

  const pkg = mapPackage(data as Record<string, unknown>);
  const children = await loadChildren(db, accountId, [pkg.id]);
  return {
    ...emptyDetail(pkg),
    itineraries: children.itineraries,
    inclusions: children.inclusions,
    exclusions: children.exclusions,
    hotels: children.hotels,
    pricing: children.pricing,
    departures: children.departures,
  };
}

export async function loadTourPackageDetails(
  db: AdminClient,
  accountId: string,
  packages: TourPackage[]
): Promise<TourPackageDetail[]> {
  const scoped = packages.filter((pkg) =>
    assertSameAccount(accountId, pkg.account_id)
  );
  const children = await loadChildren(
    db,
    accountId,
    scoped.map((pkg) => pkg.id)
  );

  return scoped.map((pkg) => ({
    ...emptyDetail(pkg),
    itineraries: children.itineraries.filter(
      (row) => row.package_id === pkg.id
    ),
    inclusions: children.inclusions.filter((row) => row.package_id === pkg.id),
    exclusions: children.exclusions.filter((row) => row.package_id === pkg.id),
    hotels: children.hotels.filter((row) => row.package_id === pkg.id),
    pricing: children.pricing.filter((row) => row.package_id === pkg.id),
    departures: children.departures.filter((row) => row.package_id === pkg.id),
  }));
}

function sanitizeWrite(input: TourPackageWriteInput): Record<string, unknown> {
  const name = input.name?.trim();
  const destination = input.destination?.trim();
  if (!name) throw new Error('PACKAGE_NAME_REQUIRED');
  if (!destination) throw new Error('PACKAGE_DESTINATION_REQUIRED');

  const durationDays = Math.max(1, Number(input.duration_days) || 1);
  const durationNights = Math.max(
    0,
    input.duration_nights == null
      ? durationDays - 1
      : Number(input.duration_nights) || 0
  );
  const minPeople = sanitizePeopleCount(input.min_people);
  const maxPeople = sanitizePeopleCount(input.max_people);
  if (minPeople != null && minPeople < 1) {
    throw new Error('PACKAGE_PARTY_SIZE_INVALID');
  }
  if (maxPeople != null && maxPeople < 1) {
    throw new Error('PACKAGE_PARTY_SIZE_INVALID');
  }
  if (minPeople != null && maxPeople != null && maxPeople < minPeople) {
    throw new Error('PACKAGE_PARTY_SIZE_INVALID');
  }

  return {
    name,
    destination,
    description: input.description?.trim() || null,
    package_type: input.package_type?.trim() || null,
    category: input.category?.trim() || null,
    duration_days: durationDays,
    duration_nights: durationNights,
    starting_price:
      input.starting_price == null || input.starting_price === ('' as never)
        ? null
        : Number(input.starting_price),
    currency: input.currency?.trim() || 'INR',
    status: input.status === 'inactive' ? 'inactive' : 'active',
    featured: Boolean(input.featured),
    valid_from: input.valid_from || null,
    valid_until: input.valid_until || null,
    booking_notes: input.booking_notes?.trim() || null,
    terms_and_conditions: input.terms_and_conditions?.trim() || null,
    cover_image_url: sanitizeCoverImageUrl(input.cover_image_url),
    price_type: input.price_type?.trim() || null,
    min_people: minPeople,
    max_people: maxPeople,
    updated_at: new Date().toISOString(),
  };
}

function sanitizePeopleCount(value: unknown): number | null {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.trunc(parsed);
}

function sanitizeCoverImageUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const url = value.trim();
  if (!url || url.length > 2000) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')
      return null;
    return url;
  } catch {
    return null;
  }
}

async function replaceChildRows(
  db: AdminClient,
  accountId: string,
  packageId: string,
  table: string,
  rows: Record<string, unknown>[]
): Promise<void> {
  const { error: deleteError } = await db
    .from(table)
    .delete()
    .eq('account_id', accountId)
    .eq('package_id', packageId);
  if (deleteError) {
    logger.error('Tour package child replace failed', {
      component: 'tour-packages',
      accountId,
      error: deleteError.message,
    });
    throw new Error('TOUR_PACKAGE_SAVE_FAILED');
  }
  if (!rows.length) return;
  const { error: insertError } = await db.from(table).insert(rows);
  if (insertError) {
    logger.error('Tour package child insert failed', {
      component: 'tour-packages',
      accountId,
      error: insertError.message,
    });
    throw new Error('TOUR_PACKAGE_SAVE_FAILED');
  }
}

async function replaceChildren(
  db: AdminClient,
  accountId: string,
  packageId: string,
  input: TourPackageWriteInput
): Promise<void> {
  if (input.itineraries !== undefined) {
    await replaceChildRows(
      db,
      accountId,
      packageId,
      CHILD_TABLES.itineraries,
      input.itineraries
        .filter((row) => row.title || row.description || row.activities)
        .map((row, index) => ({
          account_id: accountId,
          package_id: packageId,
          day_number: Number(row.day_number) || index + 1,
          title: row.title?.trim() || null,
          description: row.description?.trim() || null,
          activities: row.activities?.trim() || null,
          meals: row.meals?.trim() || null,
          hotel: row.hotel?.trim() || null,
          overnight_location: row.overnight_location?.trim() || null,
        }))
    );
  }

  if (input.inclusions !== undefined) {
    await replaceChildRows(
      db,
      accountId,
      packageId,
      CHILD_TABLES.inclusions,
      input.inclusions
        .map((row) => row.item?.trim())
        .filter(Boolean)
        .map((item) => ({
          account_id: accountId,
          package_id: packageId,
          item,
        }))
    );
  }

  if (input.exclusions !== undefined) {
    await replaceChildRows(
      db,
      accountId,
      packageId,
      CHILD_TABLES.exclusions,
      input.exclusions
        .map((row) => row.item?.trim())
        .filter(Boolean)
        .map((item) => ({
          account_id: accountId,
          package_id: packageId,
          item,
        }))
    );
  }

  if (input.hotels !== undefined) {
    await replaceChildRows(
      db,
      accountId,
      packageId,
      CHILD_TABLES.hotels,
      input.hotels
        .filter((row) => row.hotel_name?.trim())
        .map((row) => ({
          account_id: accountId,
          package_id: packageId,
          city: row.city?.trim() || null,
          hotel_name: row.hotel_name.trim(),
          star_category: row.star_category?.trim() || null,
          room_type: row.room_type?.trim() || null,
          meal_plan: row.meal_plan?.trim() || null,
          notes: row.notes?.trim() || null,
        }))
    );
  }

  if (input.pricing !== undefined) {
    await replaceChildRows(
      db,
      accountId,
      packageId,
      CHILD_TABLES.pricing,
      input.pricing
        .filter((row) => row.price != null && row.price !== ('' as never))
        .map((row) => ({
          account_id: accountId,
          package_id: packageId,
          pricing_name: row.pricing_name?.trim() || null,
          adults: Math.max(1, Number(row.adults) || 2),
          children: Math.max(0, Number(row.children) || 0),
          occupancy_type: row.occupancy_type?.trim() || null,
          price: Number(row.price),
          currency: row.currency?.trim() || 'INR',
          extra_bed: row.extra_bed == null ? null : Number(row.extra_bed),
          valid_from: row.valid_from || null,
          valid_until: row.valid_until || null,
          notes: row.notes?.trim() || null,
        }))
    );
  }

  if (input.departures !== undefined) {
    await replaceChildRows(
      db,
      accountId,
      packageId,
      CHILD_TABLES.departures,
      input.departures
        .filter((row) => row.departure_date)
        .map((row) => ({
          account_id: accountId,
          package_id: packageId,
          departure_date: row.departure_date,
          return_date: row.return_date || null,
          total_seats: row.total_seats == null ? null : Number(row.total_seats),
          available_seats:
            row.available_seats == null ? null : Number(row.available_seats),
          price: row.price == null ? null : Number(row.price),
          currency: row.currency?.trim() || 'INR',
          status: row.status || 'open',
          notes: row.notes?.trim() || null,
        }))
    );
  }
}

export async function createTourPackage(
  db: AdminClient,
  accountId: string,
  input: TourPackageWriteInput
): Promise<TourPackageDetail> {
  const payload = {
    ...sanitizeWrite(input),
    account_id: accountId,
    created_at: new Date().toISOString(),
  };

  const { data, error } = await db
    .from('tour_packages')
    .insert(payload)
    .select('*')
    .single();

  if (error || !data) {
    logger.error('Tour package create failed', {
      component: 'tour-packages',
      accountId,
      error: error?.message,
    });
    throw new Error('TOUR_PACKAGE_SAVE_FAILED');
  }

  try {
    await replaceChildren(db, accountId, String(data.id), input);
  } catch (childError) {
    await db
      .from('tour_packages')
      .delete()
      .eq('account_id', accountId)
      .eq('id', data.id);
    throw childError;
  }

  const detail = await getTourPackageDetail(db, accountId, String(data.id));
  if (!detail) throw new Error('TOUR_PACKAGE_SAVE_FAILED');
  return detail;
}

export async function updateTourPackage(
  db: AdminClient,
  accountId: string,
  packageId: string,
  input: TourPackageWriteInput
): Promise<TourPackageDetail | null> {
  const existing = await getTourPackageDetail(db, accountId, packageId);
  if (!existing) return null;

  const { data, error } = await db
    .from('tour_packages')
    .update(sanitizeWrite(input))
    .eq('account_id', accountId)
    .eq('id', packageId)
    .select('*')
    .maybeSingle();

  if (error) {
    logger.error('Tour package update failed', {
      component: 'tour-packages',
      accountId,
      error: error.message,
    });
    throw new Error('TOUR_PACKAGE_SAVE_FAILED');
  }
  if (!data) return null;

  await replaceChildren(db, accountId, packageId, input);
  return getTourPackageDetail(db, accountId, packageId);
}

export async function setTourPackageStatus(
  db: AdminClient,
  accountId: string,
  packageId: string,
  status: 'active' | 'inactive'
): Promise<TourPackage | null> {
  const { data, error } = await db
    .from('tour_packages')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('account_id', accountId)
    .eq('id', packageId)
    .select('*')
    .maybeSingle();

  if (error) {
    logger.error('Tour package status update failed', {
      component: 'tour-packages',
      accountId,
      error: error.message,
    });
    throw new Error('TOUR_PACKAGE_SAVE_FAILED');
  }
  if (!data) return null;
  return mapPackage(data as Record<string, unknown>);
}

export async function deleteTourPackage(
  db: AdminClient,
  accountId: string,
  packageId: string
): Promise<boolean> {
  const { data, error } = await db
    .from('tour_packages')
    .delete()
    .eq('account_id', accountId)
    .eq('id', packageId)
    .select('id')
    .maybeSingle();

  if (error) {
    logger.error('Tour package delete failed', {
      component: 'tour-packages',
      accountId,
      error: error.message,
    });
    throw new Error('TOUR_PACKAGE_DELETE_FAILED');
  }
  return Boolean(data);
}

export async function searchTourPackagesForAccount(
  db: AdminClient,
  accountId: string,
  requirements: TravelerRequirements,
  options?: { includeInactive?: boolean; limit?: number }
): Promise<TourPackageDetail[]> {
  let query = db.from('tour_packages').select('*').eq('account_id', accountId);

  if (!options?.includeInactive) {
    query = query.eq('status', 'active');
  }
  if (requirements.destination) {
    query = query.ilike('destination', `%${requirements.destination}%`);
  }

  const { data, error } = await query.limit(options?.limit || 40);
  if (error) {
    logger.error('Tour package search failed', {
      component: 'tour-packages',
      accountId,
      error: error.message,
    });
    throw new Error('TOUR_PACKAGE_SEARCH_FAILED');
  }

  const packages = ((data || []) as Record<string, unknown>[])
    .filter((row) => assertSameAccount(accountId, String(row.account_id)))
    .map(mapPackage);

  if (packages.length === 0 && requirements.destination) {
    let fallbackQuery = db
      .from('tour_packages')
      .select('*')
      .eq('account_id', accountId)
      .limit(options?.limit || 40);
    if (!options?.includeInactive) {
      fallbackQuery = fallbackQuery.eq('status', 'active');
    }
    const fallback = await fallbackQuery;
    if (fallback.error) {
      logger.error('Tour package fallback search failed', {
        component: 'tour-packages',
        accountId,
        error: fallback.error.message,
      });
      throw new Error('TOUR_PACKAGE_SEARCH_FAILED');
    }
    packages.push(
      ...((fallback.data || []) as Record<string, unknown>[])
        .filter((row) => assertSameAccount(accountId, String(row.account_id)))
        .map(mapPackage)
    );
  }

  return loadTourPackageDetails(db, accountId, packages);
}

export async function matchTourPackagesForMessage(
  db: AdminClient,
  accountId: string,
  message: string,
  extraContext?: string
): Promise<TourPackageMatchResult> {
  const requirements = parseTravelerRequirements(
    [extraContext, message].filter(Boolean).join('\n')
  );

  try {
    const details = await searchTourPackagesForAccount(
      db,
      accountId,
      requirements
    );
    const ranked = rankTourPackages(details, requirements);
    return {
      ...ranked,
      retrievalFailed: false,
      requirements,
    };
  } catch {
    return {
      matches: [],
      nearMatches: [],
      retrievalFailed: true,
      requirements,
    };
  }
}

export function publicRankedPackage(row: RankedTourPackage) {
  const pkg = row.package;
  return {
    name: pkg.name,
    destination: pkg.destination,
    duration_days: pkg.duration_days,
    duration_nights: pkg.duration_nights,
    starting_price: row.matchedPrice,
    currency: row.matchedCurrency || pkg.currency,
    price_type: pkg.price_type,
    package_type: pkg.package_type,
    category: pkg.category,
    status: pkg.status,
    featured: pkg.featured,
    valid_from: pkg.valid_from,
    valid_until: pkg.valid_until,
    description: pkg.description,
    inclusions: pkg.inclusions.map((item) => item.item),
    exclusions: pkg.exclusions.map((item) => item.item),
    hotels: pkg.hotels.map((hotel) => ({
      city: hotel.city,
      hotel_name: hotel.hotel_name,
      star_category: hotel.star_category,
      room_type: hotel.room_type,
      meal_plan: hotel.meal_plan,
    })),
    itinerary: pkg.itineraries.map((day) => ({
      day_number: day.day_number,
      title: day.title,
      description: day.description,
      activities: day.activities,
      meals: day.meals,
      hotel: day.hotel,
      overnight_location: day.overnight_location,
    })),
    pricing: row.matchedPricing
      ? {
          pricing_name: row.matchedPricing.pricing_name,
          adults: row.matchedPricing.adults,
          children: row.matchedPricing.children,
          occupancy_type: row.matchedPricing.occupancy_type,
          price: row.matchedPricing.price,
          currency: row.matchedPricing.currency,
        }
      : null,
    departure: row.matchedDeparture
      ? {
          departure_date: row.matchedDeparture.departure_date,
          return_date: row.matchedDeparture.return_date,
          available_seats: row.matchedDeparture.available_seats,
          total_seats: row.matchedDeparture.total_seats,
          price: row.matchedDeparture.price,
          status: row.matchedDeparture.status,
        }
      : null,
    reasons: row.reasons,
    fits_budget: row.fitsBudget,
  };
}

export function recommendablePackages(
  details: TourPackageDetail[],
  today = new Date().toISOString().slice(0, 10)
): TourPackageDetail[] {
  return details.filter((pkg) => isPackageCurrentlyActive(pkg, today));
}
