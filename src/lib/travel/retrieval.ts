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
const asNumber = (value: unknown) => {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

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
    price_for: String(row.price_for || 'Per Person'),
    image_url: (row.image_url as string | null) ?? null,
    min_people: asNumber(row.min_people),
    max_people: asNumber(row.max_people),
    status: row.status === 'inactive' ? 'inactive' : 'active',
    featured: Boolean(row.featured),
    valid_from: (row.valid_from as string | null) ?? null,
    valid_until: (row.valid_until as string | null) ?? null,
    booking_notes: (row.booking_notes as string | null) ?? null,
    terms_and_conditions: (row.terms_and_conditions as string | null) ?? null,
    created_at: String(row.created_at || ''),
    updated_at: String(row.updated_at || ''),
  };
}
const emptyDetail = (pkg: TourPackage): TourPackageDetail => ({
  ...pkg,
  itineraries: [],
  inclusions: [],
  exclusions: [],
  hotels: [],
  pricing: [],
  departures: [],
});
export const assertSameAccount = (
  accountId: string,
  rowAccountId: string | null | undefined
) => Boolean(rowAccountId && rowAccountId === accountId);

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
  if (filters?.status && filters.status !== 'all')
    query = query.eq('status', filters.status);
  if (filters?.destination?.trim())
    query = query.ilike('destination', `%${filters.destination.trim()}%`);
  if (filters?.packageType?.trim())
    query = query.ilike('package_type', `%${filters.packageType.trim()}%`);
  if (filters?.search?.trim()) {
    const term = filters.search.trim().replace(/[%_]/g, ' ');
    query = query.or(
      `name.ilike.%${term}%,destination.ilike.%${term}%,description.ilike.%${term}%,package_type.ilike.%${term}%,category.ilike.%${term}%`
    );
  }
  if (filters?.limit) query = query.limit(filters.limit);
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
    .filter((r) => assertSameAccount(accountId, String(r.account_id)))
    .map(mapPackage);
}

async function loadChildren(
  db: AdminClient,
  accountId: string,
  packageIds: string[]
) {
  if (!packageIds.length)
    return {
      itineraries: [],
      inclusions: [],
      exclusions: [],
      hotels: [],
      pricing: [],
      departures: [],
    } as {
      itineraries: TourPackageItinerary[];
      inclusions: TourPackageInclusion[];
      exclusions: TourPackageExclusion[];
      hotels: TourPackageHotel[];
      pricing: TourPackagePricing[];
      departures: TourPackageDeparture[];
    };
  const [itineraries, inclusions, exclusions, hotels, pricing, departures] =
    await Promise.all([
      db
        .from(CHILD_TABLES.itineraries)
        .select('*')
        .eq('account_id', accountId)
        .in('package_id', packageIds)
        .order('day_number'),
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
        .order('departure_date'),
    ]);
  const err = [
    itineraries.error,
    inclusions.error,
    exclusions.error,
    hotels.error,
    pricing.error,
    departures.error,
  ].find(Boolean);
  if (err) throw new Error('TOUR_PACKAGES_CHILDREN_FAILED');
  const scoped = <T extends { account_id?: string; package_id?: string }>(
    rows: T[] | null
  ) =>
    (rows || []).filter(
      (r) =>
        assertSameAccount(accountId, r.account_id) &&
        packageIds.includes(String(r.package_id))
    );
  return {
    itineraries: scoped(itineraries.data as TourPackageItinerary[]),
    inclusions: scoped(inclusions.data as TourPackageInclusion[]),
    exclusions: scoped(exclusions.data as TourPackageExclusion[]),
    hotels: scoped(hotels.data as TourPackageHotel[]),
    pricing: scoped(
      ((pricing.data || []) as Record<string, unknown>[]).map((r) => ({
        ...(r as unknown as TourPackagePricing),
        price: Number(r.price),
        extra_bed: asNumber(r.extra_bed),
      }))
    ),
    departures: scoped(
      ((departures.data || []) as Record<string, unknown>[]).map((r) => ({
        ...(r as unknown as TourPackageDeparture),
        price: asNumber(r.price),
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
  if (error) throw new Error('TOUR_PACKAGE_GET_FAILED');
  if (!data || !assertSameAccount(accountId, String(data.account_id)))
    return null;
  const pkg = mapPackage(data as Record<string, unknown>);
  const c = await loadChildren(db, accountId, [pkg.id]);
  return { ...emptyDetail(pkg), ...c };
}
export async function loadTourPackageDetails(
  db: AdminClient,
  accountId: string,
  packages: TourPackage[]
): Promise<TourPackageDetail[]> {
  const scoped = packages.filter((p) =>
    assertSameAccount(accountId, p.account_id)
  );
  const c = await loadChildren(
    db,
    accountId,
    scoped.map((p) => p.id)
  );
  return scoped.map((p) => ({
    ...emptyDetail(p),
    itineraries: c.itineraries.filter((x) => x.package_id === p.id),
    inclusions: c.inclusions.filter((x) => x.package_id === p.id),
    exclusions: c.exclusions.filter((x) => x.package_id === p.id),
    hotels: c.hotels.filter((x) => x.package_id === p.id),
    pricing: c.pricing.filter((x) => x.package_id === p.id),
    departures: c.departures.filter((x) => x.package_id === p.id),
  }));
}

function sanitizeWrite(input: TourPackageWriteInput): Record<string, unknown> {
  const name = input.name?.trim();
  const destination = input.destination?.trim();
  if (!name) throw new Error('PACKAGE_NAME_REQUIRED');
  if (!destination) throw new Error('PACKAGE_DESTINATION_REQUIRED');
  const days = Math.max(1, Number(input.duration_days) || 1);
  const nights = Math.max(
    0,
    input.duration_nights == null
      ? days - 1
      : Number(input.duration_nights) || 0
  );
  const minPeople =
    input.min_people == null
      ? null
      : Math.max(1, Number(input.min_people) || 1);
  const maxPeople =
    input.max_people == null
      ? null
      : Math.max(1, Number(input.max_people) || 1);
  if (minPeople != null && maxPeople != null && maxPeople < minPeople)
    throw new Error('TOUR_PACKAGE_PEOPLE_RANGE_INVALID');
  return {
    name,
    destination,
    description: input.description?.trim() || null,
    package_type: input.package_type?.trim() || null,
    category: input.category?.trim() || null,
    duration_days: days,
    duration_nights: nights,
    starting_price:
      input.starting_price == null ? null : Number(input.starting_price),
    currency: input.currency?.trim() || 'INR',
    price_for: input.price_for?.trim() || 'Per Person',
    image_url: input.image_url?.trim() || null,
    min_people: minPeople,
    max_people: maxPeople,
    status: input.status === 'inactive' ? 'inactive' : 'active',
    featured: Boolean(input.featured),
    valid_from: input.valid_from || null,
    valid_until: input.valid_until || null,
    booking_notes: input.booking_notes?.trim() || null,
    terms_and_conditions: input.terms_and_conditions?.trim() || null,
    updated_at: new Date().toISOString(),
  };
}

async function replaceChildren(
  db: AdminClient,
  accountId: string,
  packageId: string,
  input: TourPackageWriteInput
) {
  const deletes = await Promise.all(
    Object.values(CHILD_TABLES).map((table) =>
      db
        .from(table)
        .delete()
        .eq('account_id', accountId)
        .eq('package_id', packageId)
    )
  );
  if (deletes.find((r) => r.error)) throw new Error('TOUR_PACKAGE_SAVE_FAILED');
  const inserts: PromiseLike<{ error: { message: string } | null }>[] = [];
  const itineraries = (input.itineraries || [])
    .filter(
      (r) => r.title || r.description || r.activities || r.meals || r.hotel
    )
    .map((r, i) => ({
      account_id: accountId,
      package_id: packageId,
      day_number: Number(r.day_number) || i + 1,
      title: r.title?.trim() || null,
      description: r.description?.trim() || null,
      activities: r.activities?.trim() || null,
      meals: r.meals?.trim() || null,
      hotel: r.hotel?.trim() || null,
      overnight_location: r.overnight_location?.trim() || null,
    }));
  if (itineraries.length)
    inserts.push(db.from(CHILD_TABLES.itineraries).insert(itineraries));
  const inclusions = (input.inclusions || [])
    .map((r) => r.item?.trim())
    .filter(Boolean)
    .map((item) => ({ account_id: accountId, package_id: packageId, item }));
  if (inclusions.length)
    inserts.push(db.from(CHILD_TABLES.inclusions).insert(inclusions));
  const exclusions = (input.exclusions || [])
    .map((r) => r.item?.trim())
    .filter(Boolean)
    .map((item) => ({ account_id: accountId, package_id: packageId, item }));
  if (exclusions.length)
    inserts.push(db.from(CHILD_TABLES.exclusions).insert(exclusions));
  const hotels = (input.hotels || [])
    .filter((r) => r.hotel_name?.trim())
    .map((r) => ({
      account_id: accountId,
      package_id: packageId,
      city: r.city?.trim() || null,
      hotel_name: r.hotel_name.trim(),
      star_category: r.star_category?.trim() || null,
      room_type: r.room_type?.trim() || null,
      meal_plan: r.meal_plan?.trim() || null,
      notes: r.notes?.trim() || null,
    }));
  if (hotels.length) inserts.push(db.from(CHILD_TABLES.hotels).insert(hotels));
  const pricing = (input.pricing || [])
    .filter((r) => r.price != null)
    .map((r) => ({
      account_id: accountId,
      package_id: packageId,
      pricing_name: r.pricing_name?.trim() || null,
      adults: Math.max(1, Number(r.adults) || 2),
      children: Math.max(0, Number(r.children) || 0),
      occupancy_type: r.occupancy_type?.trim() || null,
      price: Number(r.price),
      currency: r.currency?.trim() || 'INR',
      extra_bed: r.extra_bed == null ? null : Number(r.extra_bed),
      valid_from: r.valid_from || null,
      valid_until: r.valid_until || null,
      notes: r.notes?.trim() || null,
    }));
  if (pricing.length)
    inserts.push(db.from(CHILD_TABLES.pricing).insert(pricing));
  const departures = (input.departures || [])
    .filter((r) => r.departure_date)
    .map((r) => ({
      account_id: accountId,
      package_id: packageId,
      departure_date: r.departure_date,
      return_date: r.return_date || null,
      total_seats: r.total_seats == null ? null : Number(r.total_seats),
      available_seats:
        r.available_seats == null ? null : Number(r.available_seats),
      price: r.price == null ? null : Number(r.price),
      currency: r.currency?.trim() || 'INR',
      status: r.status || 'open',
      notes: r.notes?.trim() || null,
    }));
  if (departures.length)
    inserts.push(db.from(CHILD_TABLES.departures).insert(departures));
  const results = await Promise.all(inserts);
  if (results.find((r) => r.error)) throw new Error('TOUR_PACKAGE_SAVE_FAILED');
}

export async function createTourPackage(
  db: AdminClient,
  accountId: string,
  input: TourPackageWriteInput
): Promise<TourPackageDetail> {
  const { data, error } = await db
    .from('tour_packages')
    .insert({
      ...sanitizeWrite(input),
      account_id: accountId,
      created_at: new Date().toISOString(),
    })
    .select('*')
    .single();
  if (error || !data) throw new Error('TOUR_PACKAGE_SAVE_FAILED');
  try {
    await replaceChildren(db, accountId, String(data.id), input);
  } catch (e) {
    await db
      .from('tour_packages')
      .delete()
      .eq('account_id', accountId)
      .eq('id', data.id);
    throw e;
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
  if (!(await getTourPackageDetail(db, accountId, packageId))) return null;
  const { data, error } = await db
    .from('tour_packages')
    .update(sanitizeWrite(input))
    .eq('account_id', accountId)
    .eq('id', packageId)
    .select('*')
    .maybeSingle();
  if (error) throw new Error('TOUR_PACKAGE_SAVE_FAILED');
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
  if (error) throw new Error('TOUR_PACKAGE_SAVE_FAILED');
  return data ? mapPackage(data as Record<string, unknown>) : null;
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
  if (error) throw new Error('TOUR_PACKAGE_DELETE_FAILED');
  return Boolean(data);
}

export async function searchTourPackagesForAccount(
  db: AdminClient,
  accountId: string,
  requirements: TravelerRequirements,
  options?: { includeInactive?: boolean; limit?: number }
): Promise<TourPackageDetail[]> {
  let query = db.from('tour_packages').select('*').eq('account_id', accountId);
  if (!options?.includeInactive) query = query.eq('status', 'active');
  if (requirements.destination)
    query = query.ilike('destination', `%${requirements.destination}%`);
  const { data, error } = await query.limit(options?.limit || 40);
  if (error) throw new Error('TOUR_PACKAGE_SEARCH_FAILED');
  let packages = ((data || []) as Record<string, unknown>[])
    .filter((r) => assertSameAccount(accountId, String(r.account_id)))
    .map(mapPackage);
  if (!packages.length && requirements.destination) {
    let fallback = db
      .from('tour_packages')
      .select('*')
      .eq('account_id', accountId)
      .limit(options?.limit || 40);
    if (!options?.includeInactive) fallback = fallback.eq('status', 'active');
    const f = await fallback;
    if (f.error) throw new Error('TOUR_PACKAGE_SEARCH_FAILED');
    packages = ((f.data || []) as Record<string, unknown>[])
      .filter((r) => assertSameAccount(accountId, String(r.account_id)))
      .map(mapPackage);
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
    return {
      ...rankTourPackages(details, requirements),
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
    package_type: pkg.package_type,
    category: pkg.category,
    status: pkg.status,
    featured: pkg.featured,
    valid_from: pkg.valid_from,
    valid_until: pkg.valid_until,
    description: pkg.description,
    image_url: pkg.image_url,
    price_for: pkg.price_for,
    min_people: pkg.min_people,
    max_people: pkg.max_people,
    inclusions: pkg.inclusions.map((x) => x.item),
    exclusions: pkg.exclusions.map((x) => x.item),
    hotels: pkg.hotels.map((x) => ({
      city: x.city,
      hotel_name: x.hotel_name,
      star_category: x.star_category,
      room_type: x.room_type,
      meal_plan: x.meal_plan,
    })),
    itinerary: pkg.itineraries.map((x) => ({
      day_number: x.day_number,
      title: x.title,
      description: x.description,
      activities: x.activities,
      meals: x.meals,
      hotel: x.hotel,
      overnight_location: x.overnight_location,
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
export const recommendablePackages = (
  details: TourPackageDetail[],
  today = new Date().toISOString().slice(0, 10)
) => details.filter((pkg) => isPackageCurrentlyActive(pkg, today));
