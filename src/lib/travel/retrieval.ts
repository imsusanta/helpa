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
    price_for: String(row.price_for || row.price_type || 'Per Person'),
    image_url:
      (row.image_url as string | null) ??
      (row.cover_image_url as string | null) ??
      null,
    status: row.status === 'inactive' ? 'inactive' : 'active',
    featured: Boolean(row.featured),
    valid_from: (row.valid_from as string | null) ?? null,
    valid_until: (row.valid_until as string | null) ?? null,
    booking_notes: (row.booking_notes as string | null) ?? null,
    terms_and_conditions: (row.terms_and_conditions as string | null) ?? null,
    cover_image_url:
      (row.cover_image_url as string | null) ??
      (row.image_url as string | null) ??
      null,
    price_type:
      (row.price_type as string | null) ??
      (row.price_for as string | null) ??
      null,
    min_people: asNumber(row.min_people),
    max_people: asNumber(row.max_people),
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
    const term = sanitizeIlikeTerm(filters.search);
    if (term) {
      query = query.or(
        `name.ilike.%${term}%,destination.ilike.%${term}%,description.ilike.%${term}%,package_type.ilike.%${term}%,category.ilike.%${term}%`
      );
    }
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

function sanitizeWrite(
  input: TourPackageWriteInput,
  existing?: TourPackage | null
): Record<string, unknown> {
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
    input.min_people !== undefined
      ? sanitizePeopleCount(input.min_people)
      : (existing?.min_people ?? null);
  const maxPeople =
    input.max_people !== undefined
      ? sanitizePeopleCount(input.max_people)
      : (existing?.max_people ?? null);
  if (minPeople != null && minPeople < 1) {
    throw new Error('PACKAGE_PARTY_SIZE_INVALID');
  }
  if (maxPeople != null && maxPeople < 1) {
    throw new Error('PACKAGE_PARTY_SIZE_INVALID');
  }
  if (minPeople != null && maxPeople != null && maxPeople < minPeople) {
    throw new Error('PACKAGE_PARTY_SIZE_INVALID');
  }
  const priceType =
    input.price_type?.trim() ||
    input.price_for?.trim() ||
    existing?.price_type?.trim() ||
    existing?.price_for?.trim() ||
    'Per Person';
  const incomingImage =
    input.cover_image_url !== undefined || input.image_url !== undefined
      ? sanitizeCoverImageUrl(input.cover_image_url) ||
        sanitizeCoverImageUrl(input.image_url)
      : undefined;
  const imageUrl =
    incomingImage !== undefined
      ? incomingImage
      : (existing?.cover_image_url ?? existing?.image_url ?? null);

  return {
    name,
    destination,
    description:
      input.description !== undefined
        ? input.description?.trim() || null
        : (existing?.description ?? null),
    package_type:
      input.package_type !== undefined
        ? input.package_type?.trim() || null
        : (existing?.package_type ?? null),
    category:
      input.category !== undefined
        ? input.category?.trim() || null
        : (existing?.category ?? null),
    duration_days: days,
    duration_nights: nights,
    starting_price:
      input.starting_price === undefined
        ? (existing?.starting_price ?? null)
        : input.starting_price == null
          ? null
          : Number(input.starting_price),
    currency: input.currency?.trim() || existing?.currency || 'INR',
    price_for: priceType,
    image_url: imageUrl,
    status:
      input.status !== undefined
        ? input.status === 'inactive'
          ? 'inactive'
          : 'active'
        : existing?.status === 'inactive'
          ? 'inactive'
          : 'active',
    featured:
      input.featured !== undefined
        ? Boolean(input.featured)
        : Boolean(existing?.featured),
    valid_from:
      input.valid_from !== undefined
        ? input.valid_from || null
        : (existing?.valid_from ?? null),
    valid_until:
      input.valid_until !== undefined
        ? input.valid_until || null
        : (existing?.valid_until ?? null),
    booking_notes:
      input.booking_notes !== undefined
        ? input.booking_notes?.trim() || null
        : (existing?.booking_notes ?? null),
    terms_and_conditions:
      input.terms_and_conditions !== undefined
        ? input.terms_and_conditions?.trim() || null
        : (existing?.terms_and_conditions ?? null),
    cover_image_url: imageUrl,
    price_type: priceType,
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

function sanitizeIlikeTerm(value: string): string {
  return value
    .replace(/[%_,.()"'\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const OPTIONAL_PACKAGE_COLUMNS = [
  'cover_image_url',
  'price_type',
  'image_url',
  'price_for',
  'min_people',
  'max_people',
] as const;

function missingOptionalColumn(
  error: { code?: string; message?: string } | null | undefined
): string | null {
  if (!error) return null;
  const message = error.message || '';
  const match =
    message.match(/Could not find the '([^']+)' column/i) ||
    message.match(/Could not find the "([^"]+)" column/i) ||
    message.match(/column "([^"]+)" of relation/i) ||
    message.match(/column "([^"]+)" does not exist/i);
  const column = match?.[1];
  if (
    column &&
    (OPTIONAL_PACKAGE_COLUMNS as readonly string[]).includes(column)
  ) {
    return column;
  }
  return null;
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

async function persistPackageRow(
  db: AdminClient,
  payload: Record<string, unknown>,
  mode: 'insert' | 'update',
  accountId: string,
  packageId?: string
): Promise<Record<string, unknown>> {
  let next = { ...payload };
  for (let attempt = 0; attempt <= OPTIONAL_PACKAGE_COLUMNS.length; attempt++) {
    const result =
      mode === 'insert'
        ? await db.from('tour_packages').insert(next).select('*').single()
        : await db
            .from('tour_packages')
            .update(next)
            .eq('account_id', accountId)
            .eq('id', packageId as string)
            .select('*')
            .maybeSingle();
    const missing = missingOptionalColumn(result.error);
    if (!result.error) {
      if (!result.data) throw new Error('TOUR_PACKAGE_SAVE_FAILED');
      return result.data as Record<string, unknown>;
    }
    if (!missing) {
      logger.error('Tour package persist failed', {
        component: 'tour-packages',
        accountId,
        error: result.error.message,
      });
      throw new Error('TOUR_PACKAGE_SAVE_FAILED');
    }
    delete next[missing];
  }
  throw new Error('TOUR_PACKAGE_SAVE_FAILED');
}

export async function createTourPackage(
  db: AdminClient,
  accountId: string,
  input: TourPackageWriteInput
): Promise<TourPackageDetail> {
  const data = await persistPackageRow(
    db,
    {
      ...sanitizeWrite(input),
      account_id: accountId,
      created_at: new Date().toISOString(),
    },
    'insert',
    accountId
  );
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
  const existing = await getTourPackageDetail(db, accountId, packageId);
  if (!existing) return null;
  await persistPackageRow(
    db,
    sanitizeWrite(input, existing),
    'update',
    accountId,
    packageId
  );
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
  options?: { includeInactive?: boolean; limit?: number; name?: string }
): Promise<TourPackageDetail[]> {
  let query = db.from('tour_packages').select('*').eq('account_id', accountId);
  if (!options?.includeInactive) query = query.eq('status', 'active');
  const name = options?.name?.trim();
  if (name) {
    const term = sanitizeIlikeTerm(name) || name.replace(/[%_]/g, ' ').trim();
    if (term) query = query.ilike('name', `%${term}%`);
  } else if (requirements.destination) {
    query = query.ilike('destination', `%${requirements.destination}%`);
  }
  const { data, error } = await query.limit(options?.limit || 40);
  if (error) throw new Error('TOUR_PACKAGE_SEARCH_FAILED');
  let packages = ((data || []) as Record<string, unknown>[])
    .filter((r) => assertSameAccount(accountId, String(r.account_id)))
    .map(mapPackage);
  if (!packages.length && requirements.destination && !name) {
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
    price_type: pkg.price_type,
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
