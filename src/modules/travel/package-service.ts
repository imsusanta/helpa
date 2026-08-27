/**
 * Helpa Travel Module — Tour Package Service
 *
 * Server-only reusable service for structured Tour Package CRUD,
 * AI retrieval, and proposal snapshot generation.
 */
import 'server-only';

import { getAdminClient as getSupabaseAdminClient } from '@/lib/supabase/server';

// ═══════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════

export interface TourPackage {
  id: string;
  account_id: string;
  package_code: string | null;
  name: string;
  destination: string;
  summary: string | null;
  duration_days: number;
  duration_nights: number | null;
  base_price: number | null;
  currency: string;
  price_basis: string | null;
  hotel_details: Record<string, unknown> | null;
  transport_details: Record<string, unknown> | null;
  inclusions: string[];
  exclusions: string[];
  terms_and_conditions: string | null;
  booking_deadline: string | null;
  valid_from: string | null;
  valid_until: string | null;
  status: 'draft' | 'published' | 'sold_out' | 'archived';
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface TourPackageDeparture {
  id: string;
  account_id: string;
  package_id: string;
  start_date: string;
  end_date: string | null;
  departure_price: number | null;
  total_seats: number | null;
  available_seats: number | null;
  status: 'scheduled' | 'sold_out' | 'cancelled';
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface TourPackageItineraryDay {
  id: string;
  account_id: string;
  package_id: string;
  day_number: number;
  title: string;
  description: string | null;
  meals: string | null;
  accommodation: string | null;
  created_at: string;
  updated_at: string;
}

export interface TourPackageWithDetails extends TourPackage {
  itinerary: TourPackageItineraryDay[];
  departures: TourPackageDeparture[];
}

export interface CreateTourPackageInput {
  name: string;
  destination: string;
  duration_days: number;
  duration_nights?: number | null;
  package_code?: string | null;
  summary?: string | null;
  base_price?: number | null;
  currency?: string;
  price_basis?: string | null;
  hotel_details?: Record<string, unknown> | null;
  transport_details?: Record<string, unknown> | null;
  inclusions?: string[];
  exclusions?: string[];
  terms_and_conditions?: string | null;
  booking_deadline?: string | null;
  valid_from?: string | null;
  valid_until?: string | null;
  status?: 'draft' | 'published';
  metadata?: Record<string, unknown>;
  itinerary?: Array<{
    day_number: number;
    title: string;
    description?: string | null;
    meals?: string | null;
    accommodation?: string | null;
  }>;
  departures?: Array<{
    start_date: string;
    end_date?: string | null;
    departure_price?: number | null;
    total_seats?: number | null;
    available_seats?: number | null;
    status?: 'scheduled' | 'sold_out' | 'cancelled';
    metadata?: Record<string, unknown>;
  }>;
}

export interface UpdateTourPackageInput {
  name?: string;
  destination?: string;
  duration_days?: number;
  duration_nights?: number | null;
  package_code?: string | null;
  summary?: string | null;
  base_price?: number | null;
  currency?: string;
  price_basis?: string | null;
  hotel_details?: Record<string, unknown> | null;
  transport_details?: Record<string, unknown> | null;
  inclusions?: string[];
  exclusions?: string[];
  terms_and_conditions?: string | null;
  booking_deadline?: string | null;
  valid_from?: string | null;
  valid_until?: string | null;
  status?: 'draft' | 'published' | 'sold_out' | 'archived';
  metadata?: Record<string, unknown>;
  itinerary?: Array<{
    day_number: number;
    title: string;
    description?: string | null;
    meals?: string | null;
    accommodation?: string | null;
  }>;
  departures?: Array<{
    start_date: string;
    end_date?: string | null;
    departure_price?: number | null;
    total_seats?: number | null;
    available_seats?: number | null;
    status?: 'scheduled' | 'sold_out' | 'cancelled';
    metadata?: Record<string, unknown>;
  }>;
}

// Column selections for different use cases
const PACKAGE_LIST_COLUMNS =
  'id, name, destination, summary, duration_days, duration_nights, base_price, currency, price_basis, status, valid_from, valid_until, package_code, created_at, updated_at';
const PACKAGE_DETAIL_COLUMNS = '*';
const PACKAGE_AI_COLUMNS =
  'id, name, destination, summary, duration_days, duration_nights, base_price, currency, price_basis, hotel_details, transport_details, inclusions, exclusions, status, valid_from, valid_until';

// ═══════════════════════════════════════════════════
// CRUD Operations
// ═══════════════════════════════════════════════════

/** List packages for the authenticated account with optional filters. */
export async function listPackages(
  accountId: string,
  options?: {
    status?: string;
    destination?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }
): Promise<{ data: TourPackage[]; total: number | null }> {
  const supabase = getSupabaseAdminClient();
  const limit = Math.min(100, Math.max(1, options?.limit ?? 50));
  const offset = Math.max(0, options?.offset ?? 0);

  let query = supabase
    .from('travel_packages')
    .select(PACKAGE_LIST_COLUMNS, { count: 'exact' })
    .eq('account_id', accountId);

  if (options?.status && options.status !== 'all') {
    query = query.eq('status', options.status);
  }
  if (options?.destination) {
    query = query.ilike('destination', `%${options.destination}%`);
  }
  if (options?.search) {
    const term = options.search.trim();
    query = query.or(
      `name.ilike.%${term}%,destination.ilike.%${term}%,package_code.ilike.%${term}%`
    );
  }

  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw new Error(`Failed to list packages: ${error.message}`);
  return { data: (data || []) as unknown as TourPackage[], total: count };
}

/** Get a single package with its itinerary and departures. */
export async function getPackageWithDetails(
  accountId: string,
  packageId: string
): Promise<TourPackageWithDetails | null> {
  const supabase = getSupabaseAdminClient();

  const [pkgResult, itineraryResult, departuresResult] = await Promise.all([
    supabase
      .from('travel_packages')
      .select(PACKAGE_DETAIL_COLUMNS)
      .eq('id', packageId)
      .eq('account_id', accountId)
      .maybeSingle(),
    supabase
      .from('tour_package_itinerary_days')
      .select('*')
      .eq('package_id', packageId)
      .eq('account_id', accountId)
      .order('day_number', { ascending: true }),
    supabase
      .from('tour_package_departures')
      .select('*')
      .eq('package_id', packageId)
      .eq('account_id', accountId)
      .order('start_date', { ascending: true }),
  ]);

  if (pkgResult.error || !pkgResult.data) return null;

  return {
    ...(pkgResult.data as unknown as TourPackage),
    itinerary: (itineraryResult.data ||
      []) as unknown as TourPackageItineraryDay[],
    departures: (departuresResult.data ||
      []) as unknown as TourPackageDeparture[],
  };
}

/** Create a new tour package using the atomic database RPC. */
export async function createPackage(
  accountId: string,
  userId: string,
  input: CreateTourPackageInput
): Promise<TourPackage> {
  const supabase = getSupabaseAdminClient();

  const { data: rpcData, error: rpcError } = await supabase.rpc(
    'upsert_tour_package_with_children',
    {
      p_account_id: accountId,
      p_package_id: null,
      p_user_id: userId,
      p_package_data: {
        name: input.name.trim(),
        destination: input.destination.trim(),
        duration_days: input.duration_days,
        duration_nights: input.duration_nights ?? null,
        package_code: input.package_code?.trim() || null,
        summary: input.summary?.trim() || null,
        base_price: input.base_price ?? null,
        currency: input.currency || 'INR',
        price_basis: input.price_basis || null,
        hotel_details: input.hotel_details || null,
        transport_details: input.transport_details || null,
        inclusions: input.inclusions || [],
        exclusions: input.exclusions || [],
        terms_and_conditions: input.terms_and_conditions?.trim() || null,
        booking_deadline: input.booking_deadline || null,
        valid_from: input.valid_from || null,
        valid_until: input.valid_until || null,
        status: input.status || 'draft',
        metadata: input.metadata || {},
      },
      p_itinerary: input.itinerary || [],
      p_departures: input.departures || [],
    }
  );

  if (rpcError || !rpcData) {
    throw new Error(
      `Failed to create package: ${rpcError?.message || 'Database transaction error'}`
    );
  }

  return rpcData as unknown as TourPackage;
}

/** Update an existing tour package using the atomic database RPC. */
export async function updatePackage(
  accountId: string,
  packageId: string,
  userId: string,
  input: UpdateTourPackageInput
): Promise<TourPackage> {
  const supabase = getSupabaseAdminClient();

  const existing = await getPackageWithDetails(accountId, packageId);
  if (!existing) throw new Error('Package not found in tenant');

  const { data: rpcData, error: rpcError } = await supabase.rpc(
    'upsert_tour_package_with_children',
    {
      p_account_id: accountId,
      p_package_id: packageId,
      p_user_id: userId,
      p_package_data: {
        name: input.name !== undefined ? input.name.trim() : existing.name,
        destination:
          input.destination !== undefined
            ? input.destination.trim()
            : existing.destination,
        duration_days: input.duration_days ?? existing.duration_days,
        duration_nights: input.duration_nights ?? existing.duration_nights,
        package_code:
          input.package_code !== undefined
            ? input.package_code?.trim() || null
            : existing.package_code,
        summary:
          input.summary !== undefined
            ? input.summary?.trim() || null
            : existing.summary,
        base_price:
          input.base_price !== undefined
            ? input.base_price
            : existing.base_price,
        currency: input.currency || existing.currency,
        price_basis:
          input.price_basis !== undefined
            ? input.price_basis
            : existing.price_basis,
        hotel_details:
          input.hotel_details !== undefined
            ? input.hotel_details
            : existing.hotel_details,
        transport_details:
          input.transport_details !== undefined
            ? input.transport_details
            : existing.transport_details,
        inclusions:
          input.inclusions !== undefined
            ? input.inclusions
            : existing.inclusions,
        exclusions:
          input.exclusions !== undefined
            ? input.exclusions
            : existing.exclusions,
        terms_and_conditions:
          input.terms_and_conditions !== undefined
            ? input.terms_and_conditions?.trim() || null
            : existing.terms_and_conditions,
        booking_deadline:
          input.booking_deadline !== undefined
            ? input.booking_deadline
            : existing.booking_deadline,
        valid_from:
          input.valid_from !== undefined
            ? input.valid_from
            : existing.valid_from,
        valid_until:
          input.valid_until !== undefined
            ? input.valid_until
            : existing.valid_until,
        status: input.status || existing.status,
        metadata: input.metadata || existing.metadata,
      },
      p_itinerary:
        input.itinerary !== undefined ? input.itinerary : existing.itinerary,
      p_departures:
        input.departures !== undefined ? input.departures : existing.departures,
    }
  );

  if (rpcError || !rpcData) {
    throw new Error(
      `Failed to update package: ${rpcError?.message || 'Database transaction error'}`
    );
  }

  return rpcData as unknown as TourPackage;
}

/** Archive a package (safe delete). */
export async function archivePackage(
  accountId: string,
  packageId: string,
  userId: string
): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from('travel_packages')
    .update({
      status: 'archived',
      updated_at: new Date().toISOString(),
      updated_by: userId,
    })
    .eq('id', packageId)
    .eq('account_id', accountId);
  if (error) throw new Error(`Failed to archive package: ${error.message}`);
}

/** Publish a draft package. */
export async function publishPackage(
  accountId: string,
  packageId: string,
  userId: string
): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from('travel_packages')
    .update({
      status: 'published',
      updated_at: new Date().toISOString(),
      updated_by: userId,
    })
    .eq('id', packageId)
    .eq('account_id', accountId);
  if (error) throw new Error(`Failed to publish package: ${error.message}`);
}

/** Delete a package only if it has no bookings; otherwise archive. */
export async function safeDeletePackage(
  accountId: string,
  packageId: string,
  userId: string
): Promise<{ deleted: boolean; archived: boolean }> {
  const supabase = getSupabaseAdminClient();

  // Check if any bookings or proposals reference this package
  const [bookings, proposals] = await Promise.all([
    supabase
      .from('travel_bookings')
      .select('id', { count: 'exact', head: true })
      .eq('package_id', packageId)
      .eq('account_id', accountId),
    supabase
      .from('trip_proposals')
      .select('id', { count: 'exact', head: true })
      .eq('package_id', packageId)
      .eq('account_id', accountId),
  ]);

  const hasReferences = (bookings.count || 0) + (proposals.count || 0) > 0;

  if (hasReferences) {
    await archivePackage(accountId, packageId, userId);
    return { deleted: false, archived: true };
  }

  // Safe to hard delete - delete children first then parent
  await Promise.all([
    supabase
      .from('tour_package_itinerary_days')
      .delete()
      .eq('package_id', packageId)
      .eq('account_id', accountId),
    supabase
      .from('tour_package_departures')
      .delete()
      .eq('package_id', packageId)
      .eq('account_id', accountId),
  ]);

  const { error } = await supabase
    .from('travel_packages')
    .delete()
    .eq('id', packageId)
    .eq('account_id', accountId);

  if (error) throw new Error(`Failed to delete package: ${error.message}`);
  return { deleted: true, archived: false };
}

// ═══════════════════════════════════════════════════
// AI Retrieval (Bounded, Published, Valid)
// ═══════════════════════════════════════════════════

const GENERAL_CATALOG_KEYWORDS = [
  'show packages',
  'show package',
  'list packages',
  'all packages',
  'available packages',
  'what packages',
  'package list',
  'tour packages',
  'tour plans',
  'tour list',
  'প্যাকেজ',
  'সব প্যাকেজ',
  'ট্যুর প্যাকেজ',
  'কী কী প্যাকেজ আছে',
  'কোন কোন প্যাকেজ আছে',
  'packages',
];

const STOP_WORDS = new Set([
  'what',
  'have',
  'with',
  'from',
  'price',
  'cost',
  'hotel',
  'travel',
  'tour',
  'want',
  'like',
  'need',
  'book',
  'trip',
  'please',
  'plan',
  'plans',
  'view',
  'about',
  'details',
  'show',
  'list',
  'give',
  'tell',
  'info',
  'information',
  'package',
  'packages',
  'available',
  'destination',
  'destinations',
  'koto',
  'taka',
  'hobe',
  'chai',
  'jabo',
  'ache',
  'ki',
  'kon',
  'sob',
  'কত',
  'টাকা',
  'হবে',
  'চাই',
  'যাব',
  'আছে',
  'কি',
  'কোন',
  'সব',
  'দয়া',
  'করে',
  'বলুন',
]);

function extractSearchTokens(query: string): string[] {
  // Strip all non-alphanumeric punctuation (Unicode aware)
  const cleanText = query.replace(/[^\p{L}\p{N}\s]/gu, ' ');
  const words = cleanText.split(/\s+/).map((w) => w.trim().toLowerCase());
  return words.filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
}

function isGeneralCatalogRequest(query?: string): boolean {
  if (!query || !query.trim()) return true;
  const q = query.trim().toLowerCase();
  for (const phrase of GENERAL_CATALOG_KEYWORDS) {
    if (q.includes(phrase)) return true;
  }
  const tokens = extractSearchTokens(query);
  return tokens.length === 0;
}

/** Retrieve relevant published packages for AI context. Never returns more than 5 results. */
export async function retrievePackagesForAi(
  accountId: string,
  query?: string
): Promise<TourPackageWithDetails[]> {
  const supabase = getSupabaseAdminClient();
  const today = new Date().toISOString().split('T')[0];
  const MAX_AI_RESULTS = 5;

  const isGeneral = isGeneralCatalogRequest(query);

  let dbQuery = supabase
    .from('travel_packages')
    .select(PACKAGE_AI_COLUMNS)
    .eq('account_id', accountId)
    .eq('status', 'published')
    .or(`valid_until.is.null,valid_until.gte.${today}`);

  if (!isGeneral && query) {
    const tokens = extractSearchTokens(query);
    if (tokens.length > 0) {
      // Build safe sanitized OR clauses using tokens
      const orClauses = tokens
        .slice(0, 3)
        .map(
          (t) =>
            `name.ilike.%${t}%,destination.ilike.%${t}%,summary.ilike.%${t}%`
        )
        .join(',');
      dbQuery = dbQuery.or(orClauses);
    }
  }

  const { data: rawPackages } = await dbQuery
    .order('created_at', { ascending: false })
    .limit(MAX_AI_RESULTS * 2);

  // In-memory strict date guard
  const filtered = ((rawPackages || []) as unknown as TourPackage[]).filter(
    (pkg) => {
      if (pkg.status !== 'published') return false;
      if (pkg.valid_from && pkg.valid_from > today) return false;
      if (pkg.valid_until && pkg.valid_until < today) return false;
      return true;
    }
  );

  if (!isGeneral && query) {
    const tokens = extractSearchTokens(query);
    // Strict match verification for specific queries
    const strictlyMatched = filtered.filter((pkg) => {
      const pkgStr =
        `${pkg.name} ${pkg.destination} ${pkg.summary || ''} ${pkg.package_code || ''}`.toLowerCase();
      return tokens.some((token) => pkgStr.includes(token));
    });

    if (strictlyMatched.length === 0) {
      // NEVER fall back to unrelated general packages on a specific destination miss!
      return [];
    }

    return enrichWithDetails(
      supabase,
      accountId,
      strictlyMatched.slice(0, MAX_AI_RESULTS)
    );
  }

  return enrichWithDetails(
    supabase,
    accountId,
    filtered.slice(0, MAX_AI_RESULTS)
  );
}

async function enrichWithDetails(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  accountId: string,
  packages: TourPackage[]
): Promise<TourPackageWithDetails[]> {
  if (packages.length === 0) return [];
  const packageIds = packages.map((p) => p.id);
  const today = new Date().toISOString().split('T')[0];

  const [itineraryResult, departuresResult] = await Promise.all([
    supabase
      .from('tour_package_itinerary_days')
      .select('*')
      .eq('account_id', accountId)
      .in('package_id', packageIds)
      .order('day_number', { ascending: true }),
    supabase
      .from('tour_package_departures')
      .select('*')
      .eq('account_id', accountId)
      .in('package_id', packageIds)
      .eq('status', 'scheduled')
      .gte('start_date', today)
      .order('start_date', { ascending: true }),
  ]);

  const itineraryMap = new Map<string, TourPackageItineraryDay[]>();
  for (const day of (itineraryResult.data ||
    []) as unknown as TourPackageItineraryDay[]) {
    const existing = itineraryMap.get(day.package_id) || [];
    existing.push(day);
    itineraryMap.set(day.package_id, existing);
  }

  const departureMap = new Map<string, TourPackageDeparture[]>();
  for (const dep of (departuresResult.data ||
    []) as unknown as TourPackageDeparture[]) {
    if (
      dep.status === 'scheduled' &&
      (dep.available_seats === null ||
        dep.available_seats === undefined ||
        dep.available_seats > 0)
    ) {
      const existing = departureMap.get(dep.package_id) || [];
      existing.push(dep);
      departureMap.set(dep.package_id, existing);
    }
  }

  return packages.map((pkg) => ({
    ...pkg,
    itinerary: itineraryMap.get(pkg.id) || [],
    departures: departureMap.get(pkg.id) || [],
  }));
}

/** Re-fetch and strictly validate a single package by ID for proposal/booking snapshot. */
export async function revalidatePackageForProposal(
  accountId: string,
  packageId: string,
  options?: {
    departureId?: string | null;
    requiredSeats?: number;
  }
): Promise<TourPackageWithDetails | null> {
  const pkg = await getPackageWithDetails(accountId, packageId);
  if (!pkg || pkg.account_id !== accountId) return null;

  const today = new Date().toISOString().split('T')[0];

  // 1. Status must be published
  if (pkg.status !== 'published') return null;

  // 2. Date validity window
  if (pkg.valid_from && pkg.valid_from > today) return null;
  if (pkg.valid_until && pkg.valid_until < today) return null;

  // 3. Departure validation if requested
  if (options?.departureId) {
    const dep = pkg.departures.find(
      (d) =>
        d.id === options.departureId &&
        d.package_id === packageId &&
        d.account_id === accountId
    );
    if (!dep) return null;
    if (dep.status !== 'scheduled') return null;
    if (dep.start_date < today) return null;
    if (dep.available_seats !== null && dep.available_seats !== undefined) {
      const seats = Math.max(1, options.requiredSeats ?? 1);
      if (dep.available_seats < seats) return null;
    }
  }

  return pkg;
}

// ═══════════════════════════════════════════════════
// Proposal Snapshot
// ═══════════════════════════════════════════════════

/** Generate a proposal snapshot from a package's current DB state. */
export function generateProposalSnapshot(
  pkg: TourPackageWithDetails,
  departureId?: string | null
): Record<string, unknown> {
  const selectedDeparture = departureId
    ? pkg.departures.find((d) => d.id === departureId)
    : null;

  return {
    source_package_id: pkg.id,
    source_departure_id: selectedDeparture?.id || null,
    package_name: pkg.name,
    destination: pkg.destination,
    duration_days: pkg.duration_days,
    duration_nights: pkg.duration_nights,
    base_price: selectedDeparture?.departure_price ?? pkg.base_price,
    currency: pkg.currency,
    price_basis: pkg.price_basis,
    hotel_details: pkg.hotel_details,
    transport_details: pkg.transport_details,
    inclusions: pkg.inclusions,
    exclusions: pkg.exclusions,
    itinerary: pkg.itinerary.map((day) => ({
      day: day.day_number,
      title: day.title,
      description: day.description,
      meals: day.meals,
      accommodation: day.accommodation,
    })),
    departure_date: selectedDeparture?.start_date || null,
    departure_end_date: selectedDeparture?.end_date || null,
    available_seats: selectedDeparture?.available_seats || null,
    terms_and_conditions: pkg.terms_and_conditions,
    snapshot_created_at: new Date().toISOString(),
  };
}

// ═══════════════════════════════════════════════════
// AI Context Formatting & Deterministic Fallbacks
// ═══════════════════════════════════════════════════

export const NO_MATCH_FALLBACK_BN =
  'এই মুহূর্তে আমাদের active Tour Package list-এ এই destination-এর কোনো package পাওয়া যায়নি। চাইলে একজন Travel consultant-এর সঙ্গে connect করে দিতে পারি।';
export const NO_MATCH_FALLBACK_EN =
  'No matching active tour package is currently listed in our catalog. I can connect you with a travel consultant for further assistance.';

export function getNoMatchFallback(userMessage?: string): string {
  if (!userMessage) return NO_MATCH_FALLBACK_EN;
  const hasBengaliUnicode = /[\u0980-\u09FF]/.test(userMessage);
  const hasBanglishWords =
    /\b(koto|kothay|jabo|jon|taka|ache|pabo|chai|korbo|dorkar|kichu|khobor|bhalo|shob|bengali|bangla)\b/i.test(
      userMessage
    );
  return hasBengaliUnicode || hasBanglishWords
    ? NO_MATCH_FALLBACK_BN
    : NO_MATCH_FALLBACK_EN;
}

/** Format retrieved packages into structured AI context. */
export function formatPackagesForAiContext(
  packages: TourPackageWithDetails[],
  userMessage?: string
): { context: string; fallbackMessage: string | null } {
  if (packages.length === 0) {
    return {
      context: '',
      fallbackMessage: getNoMatchFallback(userMessage),
    };
  }

  let context =
    '\n=== STRUCTURED TOUR PACKAGE DATABASE (SOURCE OF TRUTH) ===\n';
  context +=
    'The following are REAL, ACTIVE tour packages from our database. Use ONLY these records for company-specific package information.\n\n';

  for (const pkg of packages) {
    context += `--- PACKAGE [internal_id:${pkg.id}] ---\n`;
    context += `Name: ${pkg.name}\n`;
    context += `Destination: ${pkg.destination}\n`;
    context += `Duration: ${pkg.duration_days} Days`;
    if (pkg.duration_nights) context += ` / ${pkg.duration_nights} Nights`;
    context += '\n';

    if (pkg.base_price !== null && pkg.base_price !== undefined) {
      context += `Price: ${pkg.currency} ${pkg.base_price}`;
      if (pkg.price_basis) context += ` (${pkg.price_basis})`;
      context += '\n';
    } else {
      context += 'Price: Contact for pricing\n';
    }

    if (pkg.summary) context += `Summary: ${pkg.summary}\n`;

    if (pkg.hotel_details && Object.keys(pkg.hotel_details).length > 0) {
      context += `Hotel: ${JSON.stringify(pkg.hotel_details)}\n`;
    }
    if (
      pkg.transport_details &&
      Object.keys(pkg.transport_details).length > 0
    ) {
      context += `Transport: ${JSON.stringify(pkg.transport_details)}\n`;
    }

    if (pkg.inclusions && pkg.inclusions.length > 0) {
      context += `Inclusions: ${Array.isArray(pkg.inclusions) ? pkg.inclusions.join(', ') : String(pkg.inclusions)}\n`;
    }
    if (pkg.exclusions && pkg.exclusions.length > 0) {
      context += `Exclusions: ${Array.isArray(pkg.exclusions) ? pkg.exclusions.join(', ') : String(pkg.exclusions)}\n`;
    }

    // Departures
    if (pkg.departures && pkg.departures.length > 0) {
      context += 'Upcoming Departures:\n';
      for (const dep of pkg.departures) {
        context += `  - Date: ${dep.start_date}`;
        if (dep.end_date) context += ` to ${dep.end_date}`;
        if (dep.departure_price)
          context += ` | Price: ${pkg.currency} ${dep.departure_price}`;
        if (dep.available_seats !== null && dep.available_seats !== undefined) {
          context += ` | Available Seats: ${dep.available_seats}`;
        }
        context += ` | Status: ${dep.status}\n`;
      }
    }

    // Itinerary
    if (pkg.itinerary && pkg.itinerary.length > 0) {
      context += 'Day-by-Day Itinerary:\n';
      for (const day of pkg.itinerary) {
        context += `  Day ${day.day_number}: ${day.title}`;
        if (day.description) context += ` — ${day.description}`;
        if (day.meals) context += ` [Meals: ${day.meals}]`;
        if (day.accommodation) context += ` [Stay: ${day.accommodation}]`;
        context += '\n';
      }
    }

    if (pkg.valid_from || pkg.valid_until) {
      context += `Validity: ${pkg.valid_from || 'any'} to ${pkg.valid_until || 'ongoing'}\n`;
    }

    context += '\n';
  }

  return { context, fallbackMessage: null };
}
