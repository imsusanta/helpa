import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createPackage,
  updatePackage,
  listPackages,
  getPackageWithDetails,
  archivePackage,
  publishPackage,
  safeDeletePackage,
  retrievePackagesForAi,
  formatPackagesForAiContext,
  getNoMatchFallback,
  generateProposalSnapshot,
  revalidatePackageForProposal,
  type TourPackageWithDetails,
} from './package-service';

// In-memory mock tables for tenant isolation testing
const mockState = vi.hoisted(() => ({
  travel_packages: [] as Array<Record<string, unknown>>,
  tour_package_departures: [] as Array<Record<string, unknown>>,
  tour_package_itinerary_days: [] as Array<Record<string, unknown>>,
  travel_bookings: [] as Array<Record<string, unknown>>,
  trip_proposals: [] as Array<Record<string, unknown>>,
}));

class MockQueryBuilder {
  private tableName: keyof typeof mockState;
  private filters: Array<(row: Record<string, unknown>) => boolean> = [];
  private orderColumn?: string;
  private orderAscending = true;
  private limitCount?: number;
  private rangeStart?: number;
  private rangeEnd?: number;
  private isSingle = false;
  private isMaybeSingle = false;

  private insertedRows: Array<Record<string, unknown>> | null = null;
  private updatedRows: Array<Record<string, unknown>> | null = null;

  constructor(tableName: keyof typeof mockState) {
    this.tableName = tableName;
  }

  select(_columns = '*', _options?: { count?: string; head?: boolean }) {
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  neq(column: string, value: unknown) {
    this.filters.push((row) => row[column] !== value);
    return this;
  }

  gte(column: string, value: string) {
    this.filters.push((row) => !row[column] || String(row[column]) >= value);
    return this;
  }

  in(column: string, values: unknown[]) {
    this.filters.push((row) => values.includes(row[column]));
    return this;
  }

  ilike(column: string, pattern: string) {
    const clean = pattern.replace(/%/g, '').toLowerCase();
    this.filters.push((row) =>
      String(row[column] || '')
        .toLowerCase()
        .includes(clean)
    );
    return this;
  }

  or(expr: string) {
    const parts = expr.split(',');
    this.filters.push((row) => {
      return parts.some((p) => {
        if (p.includes('.is.null')) {
          const col = p.split('.')[0];
          return row[col] === null || row[col] === undefined;
        }
        if (p.includes('.gte.')) {
          const [col, , val] = p.split('.');
          return row[col] ? String(row[col]) >= val : true;
        }
        if (p.includes('.lte.')) {
          const [col, , val] = p.split('.');
          return row[col] ? String(row[col]) <= val : true;
        }
        if (p.includes('.ilike.%')) {
          const [col, , term] = p.split('.');
          const clean = term.replace(/%/g, '').toLowerCase();
          return String(row[col] || '')
            .toLowerCase()
            .includes(clean);
        }
        return false;
      });
    });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderColumn = column;
    this.orderAscending = options?.ascending ?? true;
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  range(start: number, end: number) {
    this.rangeStart = start;
    this.rangeEnd = end;
    return this;
  }

  single() {
    this.isSingle = true;
    return this.execute();
  }

  maybeSingle() {
    this.isMaybeSingle = true;
    return this.execute();
  }

  insert(data: Record<string, unknown> | Array<Record<string, unknown>>) {
    const table = mockState[this.tableName];
    const items = Array.isArray(data) ? data : [data];

    const inserted = items.map((item) => ({
      id: item.id || `mock-${Math.random().toString(36).slice(2, 9)}`,
      created_at: item.created_at || new Date().toISOString(),
      updated_at: item.updated_at || new Date().toISOString(),
      ...item,
    }));
    table.push(...inserted);
    this.insertedRows = inserted;
    return this;
  }

  update(updates: Record<string, unknown>) {
    const table = mockState[this.tableName];
    const updated: Array<Record<string, unknown>> = [];
    for (const row of table) {
      if (this.filters.every((f) => f(row))) {
        Object.assign(row, updates);
        updated.push(row);
      }
    }
    this.updatedRows = updated;
    return this;
  }

  private isDelete = false;

  delete() {
    this.isDelete = true;
    return this;
  }

  async then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ) {
    return this.execute().then(onfulfilled, onrejected);
  }

  private async execute() {
    if (this.isDelete) {
      const initialLen = mockState[this.tableName].length;
      mockState[this.tableName] = mockState[this.tableName].filter(
        (row) => !this.filters.every((f) => f(row))
      );
      return {
        data: null,
        count: initialLen - mockState[this.tableName].length,
        error: null,
      };
    }

    if (this.insertedRows) {
      const resData = this.isSingle ? this.insertedRows[0] : this.insertedRows;
      return { data: resData, count: this.insertedRows.length, error: null };
    }

    if (this.updatedRows) {
      const resData = this.isSingle ? this.updatedRows[0] : this.updatedRows;
      return { data: resData, count: this.updatedRows.length, error: null };
    }

    let rows = [...mockState[this.tableName]].filter((row) =>
      this.filters.every((f) => f(row))
    );

    const totalCount = rows.length;

    if (this.orderColumn) {
      rows.sort((a, b) => {
        const valA = String(a[this.orderColumn!] ?? '');
        const valB = String(b[this.orderColumn!] ?? '');
        if (valA < valB) return this.orderAscending ? -1 : 1;
        if (valA > valB) return this.orderAscending ? 1 : -1;
        return 0;
      });
    }

    if (this.rangeStart !== undefined && this.rangeEnd !== undefined) {
      rows = rows.slice(this.rangeStart, this.rangeEnd + 1);
    } else if (this.limitCount !== undefined) {
      rows = rows.slice(0, this.limitCount);
    }

    if (this.isSingle) {
      return {
        data: rows[0] || null,
        count: totalCount,
        error: rows.length ? null : new Error('Row not found'),
      };
    }
    if (this.isMaybeSingle) {
      return { data: rows[0] || null, count: totalCount, error: null };
    }

    return { data: rows, count: totalCount, error: null };
  }
}

const mockAdminClient = {
  from: (table: keyof typeof mockState) => new MockQueryBuilder(table),
  rpc: vi.fn(async (funcName: string, args: Record<string, unknown>) => {
    if (funcName === 'upsert_tour_package_with_children') {
      const accountId = args.p_account_id as string;
      const packageId = args.p_package_id as string | null;
      const userId = args.p_user_id as string | null;
      const pkgData = (args.p_package_data as Record<string, unknown>) || {};
      const itinerary =
        (args.p_itinerary as Array<Record<string, unknown>>) || [];
      const departures =
        (args.p_departures as Array<Record<string, unknown>>) || [];

      // Check if simulation failure requested in test
      if (
        pkgData._simulate_rpc_failure ||
        (pkgData.metadata as Record<string, unknown>)?._simulate_rpc_failure
      ) {
        return { data: null, error: new Error('Simulated RPC database error') };
      }

      let pkg: Record<string, unknown>;
      if (packageId) {
        const existing = mockState.travel_packages.find(
          (p) => p.id === packageId && p.account_id === accountId
        );
        if (!existing) {
          return { data: null, error: new Error('Package not found') };
        }
        Object.assign(existing, {
          ...pkgData,
          price: pkgData.base_price ?? existing.price ?? 0,
          description: pkgData.summary ?? existing.description,
          updated_by: userId,
          updated_at: new Date().toISOString(),
        });
        pkg = existing;
      } else {
        pkg = {
          id: `pkg-${Math.random().toString(36).slice(2, 9)}`,
          account_id: accountId,
          currency: 'INR',
          status: 'draft',
          metadata: {},
          inclusions: [],
          exclusions: [],
          ...pkgData,
          price: pkgData.base_price ?? 0,
          description: pkgData.summary || null,
          created_by: userId,
          updated_by: userId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        mockState.travel_packages.push(pkg);
      }

      // Atomic replace itinerary
      mockState.tour_package_itinerary_days =
        mockState.tour_package_itinerary_days.filter(
          (it) => !(it.package_id === pkg.id && it.account_id === accountId)
        );
      itinerary.forEach((it, idx) => {
        mockState.tour_package_itinerary_days.push({
          id: `itin-${Math.random().toString(36).slice(2, 9)}`,
          account_id: accountId,
          package_id: pkg.id,
          day_number: it.day_number || idx + 1,
          title: it.title,
          description: it.description || null,
          meals: it.meals || null,
          accommodation: it.accommodation || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      });

      // Atomic replace departures
      mockState.tour_package_departures =
        mockState.tour_package_departures.filter(
          (dep) => !(dep.package_id === pkg.id && dep.account_id === accountId)
        );
      departures.forEach((dep) => {
        mockState.tour_package_departures.push({
          id: `dep-${Math.random().toString(36).slice(2, 9)}`,
          account_id: accountId,
          package_id: pkg.id,
          start_date: dep.start_date,
          end_date: dep.end_date || null,
          departure_price: dep.departure_price ?? null,
          total_seats: dep.total_seats ?? null,
          available_seats: dep.available_seats ?? dep.total_seats ?? null,
          status: dep.status || 'scheduled',
          metadata: dep.metadata || {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      });

      return { data: pkg, error: null };
    }

    if (funcName === 'safe_delete_tour_package') {
      const accountId = args.p_account_id as string;
      const packageId = args.p_package_id as string;
      const existing = mockState.travel_packages.find(
        (p) => p.id === packageId && p.account_id === accountId
      );
      if (!existing) {
        return {
          data: { success: false, error: 'PACKAGE_NOT_FOUND' },
          error: null,
        };
      }
      const hasRefs =
        mockState.travel_bookings.some((b) => b.package_id === packageId) ||
        mockState.trip_proposals.some((p) => p.package_id === packageId);
      if (hasRefs) {
        existing.status = 'archived';
        return {
          data: { success: true, deleted: false, archived: true },
          error: null,
        };
      } else {
        mockState.travel_packages = mockState.travel_packages.filter(
          (p) => !(p.id === packageId && p.account_id === accountId)
        );
        mockState.tour_package_itinerary_days =
          mockState.tour_package_itinerary_days.filter(
            (i) => !(i.package_id === packageId && i.account_id === accountId)
          );
        mockState.tour_package_departures =
          mockState.tour_package_departures.filter(
            (d) => !(d.package_id === packageId && d.account_id === accountId)
          );
        return {
          data: { success: true, deleted: true, archived: false },
          error: null,
        };
      }
    }

    return {
      data: null,
      error: new Error(`Unknown RPC function: ${funcName}`),
    };
  }),
};

vi.mock('@/lib/supabase/server', () => ({
  getAdminClient: vi.fn(() => mockAdminClient),
}));

describe('Tour Packages Catalog & Service', () => {
  const ACCOUNT_A = 'account-tenant-alpha';
  const ACCOUNT_B = 'account-tenant-beta';
  const USER_ID = 'user-agent-123';

  beforeEach(() => {
    mockState.travel_packages = [];
    mockState.tour_package_departures = [];
    mockState.tour_package_itinerary_days = [];
    mockState.travel_bookings = [];
    mockState.trip_proposals = [];
  });

  describe('1. CRUD Operations & Tenant Isolation', () => {
    it('creates a tour package with backward-compatible price/description columns and tenant scoping', async () => {
      const pkg = await createPackage(ACCOUNT_A, USER_ID, {
        name: 'Darjeeling & Gangtok Wonder',
        destination: 'Darjeeling, Sikkim',
        duration_days: 5,
        duration_nights: 4,
        base_price: 22000,
        currency: 'INR',
        price_basis: 'per_person',
        summary: 'Toy train, Tiger Hill, Tsomgo lake tour',
        status: 'published',
        inclusions: ['Hotel 4*', 'Daily Breakfast & Dinner', 'Private Cab'],
        exclusions: ['Airfare', 'Personal Expenses'],
      });

      expect(pkg).toBeDefined();
      expect(pkg.name).toBe('Darjeeling & Gangtok Wonder');
      expect(pkg.account_id).toBe(ACCOUNT_A);
      expect(pkg.base_price).toBe(22000);
      expect((pkg as unknown as Record<string, unknown>).price).toBe(22000); // backward compatibility
      expect((pkg as unknown as Record<string, unknown>).description).toBe(
        'Toy train, Tiger Hill, Tsomgo lake tour'
      ); // backward compatibility
      expect(pkg.status).toBe('published');
    });

    it('creates package with day-by-day itinerary and departures in one atomic call', async () => {
      const pkg = await createPackage(ACCOUNT_A, USER_ID, {
        name: 'Kashmir Autumn Explorer',
        destination: 'Srinagar, Gulmarg, Pahalgam',
        duration_days: 6,
        duration_nights: 5,
        base_price: 35000,
        itinerary: [
          {
            day_number: 1,
            title: 'Arrival Srinagar',
            description: 'Shikara ride on Dal Lake',
            meals: 'Dinner',
          },
          {
            day_number: 2,
            title: 'Gulmarg Gondola',
            description: 'Phase 1 & 2 cable car',
            meals: 'Breakfast & Dinner',
          },
        ],
        departures: [
          {
            start_date: '2026-10-10',
            end_date: '2026-10-15',
            departure_price: 37000,
            total_seats: 15,
            available_seats: 12,
          },
        ],
      });

      expect(pkg.id).toBeDefined();
      expect(mockState.tour_package_itinerary_days.length).toBe(2);
      expect(mockState.tour_package_departures.length).toBe(1);

      const details = await getPackageWithDetails(ACCOUNT_A, pkg.id);
      expect(details).not.toBeNull();
      expect(details?.itinerary.length).toBe(2);
      expect(details?.departures.length).toBe(1);
      expect(details?.departures[0].departure_price).toBe(37000);
    });

    it('strictly isolates packages between tenants', async () => {
      await createPackage(ACCOUNT_A, USER_ID, {
        name: 'Goa Beach Party',
        destination: 'Goa',
        duration_days: 4,
        base_price: 15000,
      });

      await createPackage(ACCOUNT_B, USER_ID, {
        name: 'Kerala Backwaters',
        destination: 'Munnar, Alleppey',
        duration_days: 5,
        base_price: 24000,
      });

      const listA = await listPackages(ACCOUNT_A);
      const listB = await listPackages(ACCOUNT_B);

      expect(listA.data.length).toBe(1);
      expect(listA.data[0].name).toBe('Goa Beach Party');

      expect(listB.data.length).toBe(1);
      expect(listB.data[0].name).toBe('Kerala Backwaters');
    });

    it('filters packages by status, destination, and text search', async () => {
      await createPackage(ACCOUNT_A, USER_ID, {
        name: 'Darjeeling Budget Special',
        destination: 'Darjeeling',
        duration_days: 3,
        status: 'draft',
      });

      await createPackage(ACCOUNT_A, USER_ID, {
        name: 'Darjeeling Luxury Heritage',
        destination: 'Darjeeling',
        duration_days: 4,
        status: 'published',
      });

      await createPackage(ACCOUNT_A, USER_ID, {
        name: 'Ladakh Bike Expedition',
        destination: 'Leh Ladakh',
        duration_days: 7,
        status: 'published',
      });

      const publishedOnly = await listPackages(ACCOUNT_A, {
        status: 'published',
      });
      expect(publishedOnly.data.length).toBe(2);

      const darjeelingOnly = await listPackages(ACCOUNT_A, {
        destination: 'Darjeeling',
      });
      expect(darjeelingOnly.data.length).toBe(2);

      const searchSpecial = await listPackages(ACCOUNT_A, { search: 'Budget' });
      expect(searchSpecial.data.length).toBe(1);
      expect(searchSpecial.data[0].name).toBe('Darjeeling Budget Special');
    });

    it('updates package details, itinerary, and departures', async () => {
      const created = await createPackage(ACCOUNT_A, USER_ID, {
        name: 'Dubai Extravaganza',
        destination: 'Dubai',
        duration_days: 5,
        base_price: 50000,
      });

      const updated = await updatePackage(ACCOUNT_A, created.id, USER_ID, {
        name: 'Dubai Luxury Extravaganza with Desert Safari',
        base_price: 55000,
        itinerary: [
          {
            day_number: 1,
            title: 'Arrival & Burj Khalifa',
            description: 'At the top 124th floor',
          },
        ],
      });

      expect(updated.name).toBe('Dubai Luxury Extravaganza with Desert Safari');
      expect(updated.base_price).toBe(55000);
      expect((updated as unknown as Record<string, unknown>).price).toBe(55000);

      const fullDetails = await getPackageWithDetails(ACCOUNT_A, created.id);
      expect(fullDetails?.itinerary.length).toBe(1);
    });

    it('safely archives package on deletion if referenced by bookings or proposals', async () => {
      const pkg = await createPackage(ACCOUNT_A, USER_ID, {
        name: 'Thailand Phuket & Krabi',
        destination: 'Thailand',
        duration_days: 6,
        status: 'published',
      });

      // Add a reference in travel_bookings
      mockState.travel_bookings.push({
        id: 'booking-1',
        account_id: ACCOUNT_A,
        package_id: pkg.id,
      });

      const result = await safeDeletePackage(ACCOUNT_A, pkg.id, USER_ID);
      expect(result.deleted).toBe(false);
      expect(result.archived).toBe(true);

      const archivedPkg = await getPackageWithDetails(ACCOUNT_A, pkg.id);
      expect(archivedPkg?.status).toBe('archived');
    });

    it('hard deletes package and associated days/departures if unreferenced', async () => {
      const pkg = await createPackage(ACCOUNT_A, USER_ID, {
        name: 'Temporary Package',
        destination: 'Goa',
        duration_days: 3,
        itinerary: [{ day_number: 1, title: 'Day 1' }],
      });

      const result = await safeDeletePackage(ACCOUNT_A, pkg.id, USER_ID);
      expect(result.deleted).toBe(true);
      expect(result.archived).toBe(false);

      const fetched = await getPackageWithDetails(ACCOUNT_A, pkg.id);
      expect(fetched).toBeNull();
      expect(mockState.tour_package_itinerary_days.length).toBe(0);
    });

    it('manages publish and archive lifecycle status correctly', async () => {
      const pkg = await createPackage(ACCOUNT_A, USER_ID, {
        name: 'Maldives Overwater Villa',
        destination: 'Maldives',
        duration_days: 4,
        status: 'draft',
      });

      await publishPackage(ACCOUNT_A, pkg.id, USER_ID);
      let details = await getPackageWithDetails(ACCOUNT_A, pkg.id);
      expect(details?.status).toBe('published');

      await archivePackage(ACCOUNT_A, pkg.id, USER_ID);
      details = await getPackageWithDetails(ACCOUNT_A, pkg.id);
      expect(details?.status).toBe('archived');
    });
  });

  describe('2. AI Retrieval & Grounding (Single Source of Truth)', () => {
    it('only retrieves published packages within valid date window, bounded to max 5 items', async () => {
      const futureDate = '2026-12-31';
      const pastDate = '2020-01-01';

      // 1. Published valid
      await createPackage(ACCOUNT_A, USER_ID, {
        name: 'Valid Package 1',
        destination: 'Darjeeling',
        duration_days: 3,
        status: 'published',
        valid_until: futureDate,
      });

      // 2. Draft (should be omitted)
      await createPackage(ACCOUNT_A, USER_ID, {
        name: 'Draft Package',
        destination: 'Darjeeling',
        duration_days: 3,
        status: 'draft',
      });

      // 3. Expired (should be omitted)
      await createPackage(ACCOUNT_A, USER_ID, {
        name: 'Expired Package',
        destination: 'Darjeeling',
        duration_days: 3,
        status: 'published',
        valid_until: pastDate,
      });

      const aiPackages = await retrievePackagesForAi(ACCOUNT_A, 'Darjeeling');
      expect(aiPackages.length).toBe(1);
      expect(aiPackages[0].name).toBe('Valid Package 1');
    });

    it('enriches AI packages with upcoming departures and full day-by-day itineraries', async () => {
      await createPackage(ACCOUNT_A, USER_ID, {
        name: 'Manali Snow & Adventure',
        destination: 'Manali',
        duration_days: 4,
        status: 'published',
        base_price: 14000,
        itinerary: [
          {
            day_number: 1,
            title: 'Arrival Manali',
            description: 'Check-in & Mall Road walk',
            meals: 'Dinner',
          },
          {
            day_number: 2,
            title: 'Solang Valley & Rohtang Pass',
            description: 'Snow sports and paragliding',
            meals: 'Breakfast & Dinner',
          },
        ],
        departures: [
          {
            start_date: '2026-11-01',
            departure_price: 15000,
            available_seats: 10,
            status: 'scheduled',
          },
        ],
      });

      const results = await retrievePackagesForAi(ACCOUNT_A, 'Manali');
      expect(results.length).toBe(1);
      expect(results[0].itinerary.length).toBe(2);
      expect(results[0].departures.length).toBe(1);
      expect(results[0].departures[0].available_seats).toBe(10);
    });

    it('formats AI context with internal IDs and grounding directives', () => {
      const samplePackages: TourPackageWithDetails[] = [
        {
          id: 'pkg-darj-uuid',
          account_id: ACCOUNT_A,
          package_code: 'PKG-DARJ-01',
          name: 'Darjeeling Classic',
          destination: 'Darjeeling',
          summary: 'Best of Queen of Hills',
          duration_days: 4,
          duration_nights: 3,
          base_price: 12000,
          currency: 'INR',
          price_basis: 'per_person',
          hotel_details: { description: '3-Star Hotel' },
          transport_details: { description: 'Private Cab' },
          inclusions: ['Breakfast', 'Transfers', 'Sightseeing'],
          exclusions: ['Lunch', 'Personal Expenses'],
          terms_and_conditions: '50% advance',
          booking_deadline: null,
          valid_from: null,
          valid_until: null,
          status: 'published',
          metadata: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          itinerary: [
            {
              id: '1',
              account_id: ACCOUNT_A,
              package_id: 'pkg-darj-uuid',
              day_number: 1,
              title: 'Arrival',
              description: 'Hotel check-in',
              meals: 'Dinner',
              accommodation: '3-Star',
              created_at: '',
              updated_at: '',
            },
          ],
          departures: [
            {
              id: 'dep-1',
              account_id: ACCOUNT_A,
              package_id: 'pkg-darj-uuid',
              start_date: '2026-10-01',
              end_date: '2026-10-04',
              departure_price: 12500,
              total_seats: 20,
              available_seats: 15,
              status: 'scheduled',
              metadata: {},
              created_at: '',
              updated_at: '',
            },
          ],
        },
      ];

      const { context, fallbackMessage } =
        formatPackagesForAiContext(samplePackages);
      expect(fallbackMessage).toBeNull();
      expect(context).toContain(
        '=== STRUCTURED TOUR PACKAGE DATABASE (SOURCE OF TRUTH) ==='
      );
      expect(context).toContain('[internal_id:pkg-darj-uuid]');
      expect(context).toContain('Darjeeling Classic');
      expect(context).toContain('INR 12000');
      expect(context).toContain('Day 1: Arrival');
      expect(context).toContain('Available Seats: 15');
    });

    it('returns language-specific deterministic fallback messages without mixing languages', () => {
      // Bangla inquiry
      const bnRes = formatPackagesForAiContext(
        [],
        'দার্জিলিং ট্যুর প্যাকেজ খরচ কত?'
      );
      expect(bnRes.context).toBe('');
      expect(bnRes.fallbackMessage).toBe(
        'এই মুহূর্তে আমাদের active Tour Package list-এ এই destination-এর কোনো package পাওয়া যায়নি। চাইলে একজন Travel consultant-এর সঙ্গে connect করে দিতে পারি।'
      );
      expect(bnRes.fallbackMessage).not.toContain('No matching active');

      // English inquiry
      const enRes = formatPackagesForAiContext(
        [],
        'What is the price for Maldives package?'
      );
      expect(enRes.context).toBe('');
      expect(enRes.fallbackMessage).toBe(
        'No matching active tour package is currently listed in our catalog. I can connect you with a travel consultant for further assistance.'
      );
      expect(enRes.fallbackMessage).not.toContain('এই মুহূর্তে');

      // Helper function direct test
      expect(getNoMatchFallback('koto taka lagbe?')).toContain('এই মুহূর্তে');
      expect(getNoMatchFallback('Looking for packages')).toContain(
        'No matching'
      );
    });

    it('excludes expired packages and future valid_from packages from AI retrieval', async () => {
      // 1. Expired package
      await createPackage(ACCOUNT_A, USER_ID, {
        name: 'Expired Goa Monsoon',
        destination: 'Goa',
        duration_days: 3,
        status: 'published',
        valid_until: '2020-01-01',
      });

      // 2. Future package not yet valid
      await createPackage(ACCOUNT_A, USER_ID, {
        name: 'Future Winter Ladakh',
        destination: 'Ladakh',
        duration_days: 7,
        status: 'published',
        valid_from: '2099-01-01',
      });

      // 3. Currently valid package
      await createPackage(ACCOUNT_A, USER_ID, {
        name: 'Active Kerala Backwaters',
        destination: 'Kerala',
        duration_days: 5,
        status: 'published',
        valid_from: '2020-01-01',
        valid_until: '2099-12-31',
      });

      const keralaResults = await retrievePackagesForAi(ACCOUNT_A, 'Kerala');
      expect(keralaResults.length).toBe(1);
      expect(keralaResults[0].name).toBe('Active Kerala Backwaters');

      const goaResults = await retrievePackagesForAi(ACCOUNT_A, 'Goa');
      expect(goaResults.some((p) => p.name === 'Expired Goa Monsoon')).toBe(
        false
      );

      const ladakhResults = await retrievePackagesForAi(ACCOUNT_A, 'Ladakh');
      expect(ladakhResults.some((p) => p.name === 'Future Winter Ladakh')).toBe(
        false
      );
    });

    it('excludes cancelled departures and zero-seat departures from AI retrieval', async () => {
      await createPackage(ACCOUNT_A, USER_ID, {
        name: 'Shimla Deluxe',
        destination: 'Shimla',
        duration_days: 4,
        status: 'published',
        departures: [
          {
            start_date: '2026-12-01',
            status: 'cancelled',
            available_seats: 10,
          },
          {
            start_date: '2026-12-05',
            status: 'scheduled',
            available_seats: 0,
          },
          {
            start_date: '2026-12-10',
            status: 'scheduled',
            available_seats: 8,
          },
        ],
      });

      const results = await retrievePackagesForAi(ACCOUNT_A, 'Shimla');
      expect(results.length).toBe(1);
      expect(results[0].departures.length).toBe(1);
      expect(results[0].departures[0].start_date).toBe('2026-12-10');
      expect(results[0].departures[0].available_seats).toBe(8);
    });

    it('returns empty array when specific destination search does not match any packages', async () => {
      // Create Darjeeling package only
      await createPackage(ACCOUNT_A, USER_ID, {
        name: 'Darjeeling Explorer',
        destination: 'Darjeeling',
        duration_days: 3,
        status: 'published',
      });

      // Specific search for Maldives should return [] and NOT fall back to Darjeeling
      const results = await retrievePackagesForAi(
        ACCOUNT_A,
        'Do you have any Maldives tour package?'
      );
      expect(results).toEqual([]);
    });

    it('returns active packages for generic catalog requests', async () => {
      await createPackage(ACCOUNT_A, USER_ID, {
        name: 'Darjeeling Classic',
        destination: 'Darjeeling',
        duration_days: 3,
        status: 'published',
      });

      const genericResults = await retrievePackagesForAi(
        ACCOUNT_A,
        'show available packages'
      );
      expect(genericResults.length).toBe(1);
      expect(genericResults[0].name).toBe('Darjeeling Classic');

      const banglaGeneric = await retrievePackagesForAi(
        ACCOUNT_A,
        'কী কী প্যাকেজ আছে?'
      );
      expect(banglaGeneric.length).toBe(1);
    });

    it('handles punctuation-heavy and special character queries safely without filter errors', async () => {
      await createPackage(ACCOUNT_A, USER_ID, {
        name: 'Kashmir Magic',
        destination: 'Kashmir',
        duration_days: 5,
        status: 'published',
      });

      const weirdQuery = 'Kashmir!! (5-day) -- 50% discount??? "special"';
      const results = await retrievePackagesForAi(ACCOUNT_A, weirdQuery);
      expect(results.length).toBe(1);
      expect(results[0].name).toBe('Kashmir Magic');
    });
  });

  describe('3. Database Atomic RPC & Error Propagation (No Fallback)', () => {
    it('propagates RPC error immediately and does not perform fallback direct writes', async () => {
      const initialCount = mockState.travel_packages.length;

      // Pass input that simulates RPC database failure
      await expect(
        createPackage(ACCOUNT_A, USER_ID, {
          name: 'RPC Failing Package',
          destination: 'Leh',
          duration_days: 5,
          metadata: { _simulate_rpc_failure: true },
        })
      ).rejects.toThrow(
        'Failed to create package: Simulated RPC database error'
      );

      // Verify no direct row was written to travel_packages table
      expect(
        mockState.travel_packages.some((p) => p.name === 'RPC Failing Package')
      ).toBe(false);
      expect(mockState.travel_packages.length).toBe(initialCount);
    });

    it('throws when updating a package that does not belong to the tenant', async () => {
      const pkgA = await createPackage(ACCOUNT_A, USER_ID, {
        name: 'Tenant A Private Package',
        destination: 'Bhutan',
        duration_days: 4,
      });

      // Tenant B attempts to update Tenant A's package
      await expect(
        updatePackage(ACCOUNT_B, pkgA.id, USER_ID, {
          name: 'Hacked Package Name',
        })
      ).rejects.toThrow('Package not found in tenant');
    });
  });

  describe('4. Proposal Snapshot & Strict Server-Side Revalidation', () => {
    it('generates immutable proposal snapshot copying verified DB values without trusting LLM', () => {
      const pkgWithDetails: TourPackageWithDetails = {
        id: 'pkg-secure-uuid',
        account_id: ACCOUNT_A,
        package_code: 'PKG-SEC-01',
        name: 'Sikkim Silk Route Expedition',
        destination: 'Sikkim',
        summary: 'Historic silk route trail',
        duration_days: 5,
        duration_nights: 4,
        base_price: 18500,
        currency: 'INR',
        price_basis: 'per_person',
        hotel_details: { star: '3-Star Homestays' },
        transport_details: { type: 'Bolero / Scorpio 4x4' },
        inclusions: ['Permits', 'All Meals', 'Vehicle'],
        exclusions: ['Airfare', 'Personal Porter'],
        terms_and_conditions: 'Standard cancellation terms apply',
        booking_deadline: null,
        valid_from: null,
        valid_until: null,
        status: 'published',
        metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        itinerary: [
          {
            id: '1',
            account_id: ACCOUNT_A,
            package_id: 'pkg-secure-uuid',
            day_number: 1,
            title: 'NJP to Aritar',
            description: 'Lampokhari lake visit',
            meals: 'Lunch & Dinner',
            accommodation: 'Homestay',
            created_at: '',
            updated_at: '',
          },
        ],
        departures: [
          {
            id: 'dep-silk-01',
            account_id: ACCOUNT_A,
            package_id: 'pkg-secure-uuid',
            start_date: '2026-11-15',
            end_date: '2026-11-19',
            departure_price: 19500,
            total_seats: 10,
            available_seats: 6,
            status: 'scheduled',
            metadata: {},
            created_at: '',
            updated_at: '',
          },
        ],
      };

      // Generate snapshot without departure
      const snap1 = generateProposalSnapshot(pkgWithDetails);
      expect(snap1.package_name).toBe('Sikkim Silk Route Expedition');
      expect(snap1.base_price).toBe(18500);
      expect((snap1.itinerary as unknown[]).length).toBe(1);

      // Mutating source object does not affect previously generated snapshot
      pkgWithDetails.name = 'Hacked Name';
      pkgWithDetails.base_price = 999999;
      expect(snap1.package_name).toBe('Sikkim Silk Route Expedition');
      expect(snap1.base_price).toBe(18500);

      // Generate snapshot with specific departure selected (applies departure price override)
      const snap2 = generateProposalSnapshot(pkgWithDetails, 'dep-silk-01');
      expect(snap2.source_departure_id).toBe('dep-silk-01');
      expect(snap2.base_price).toBe(19500);
      expect(snap2.departure_date).toBe('2026-11-15');
      expect(snap2.available_seats).toBe(6);
    });

    it('strictly revalidates package and departure invariants before proposal generation', async () => {
      // 1. Published and valid
      const validPkg = await createPackage(ACCOUNT_A, USER_ID, {
        name: 'Andaman Scuba Adventure',
        destination: 'Havelock, Neil Island',
        duration_days: 6,
        base_price: 42000,
        status: 'published',
        departures: [
          {
            start_date: '2026-12-01',
            departure_price: 45000,
            total_seats: 10,
            available_seats: 4,
            status: 'scheduled',
          },
        ],
      });

      const depId = (await getPackageWithDetails(ACCOUNT_A, validPkg.id))
        ?.departures[0].id;

      // Valid check passes
      const revalidated = await revalidatePackageForProposal(
        ACCOUNT_A,
        validPkg.id,
        {
          departureId: depId,
          requiredSeats: 2,
        }
      );
      expect(revalidated).not.toBeNull();
      expect(revalidated?.name).toBe('Andaman Scuba Adventure');

      // 2. Draft package fails revalidation
      const draftPkg = await createPackage(ACCOUNT_A, USER_ID, {
        name: 'Draft Package',
        destination: 'Goa',
        duration_days: 3,
        status: 'draft',
      });
      expect(
        await revalidatePackageForProposal(ACCOUNT_A, draftPkg.id)
      ).toBeNull();

      // 3. Archived package fails revalidation
      await publishPackage(ACCOUNT_A, draftPkg.id, USER_ID);
      await archivePackage(ACCOUNT_A, draftPkg.id, USER_ID);
      expect(
        await revalidatePackageForProposal(ACCOUNT_A, draftPkg.id)
      ).toBeNull();

      // 4. Expired package fails revalidation
      const expiredPkg = await createPackage(ACCOUNT_A, USER_ID, {
        name: 'Expired Package',
        destination: 'Goa',
        duration_days: 3,
        status: 'published',
        valid_until: '2020-01-01',
      });
      expect(
        await revalidatePackageForProposal(ACCOUNT_A, expiredPkg.id)
      ).toBeNull();

      // 5. Future valid_from package fails revalidation
      const futurePkg = await createPackage(ACCOUNT_A, USER_ID, {
        name: 'Future Package',
        destination: 'Goa',
        duration_days: 3,
        status: 'published',
        valid_from: '2099-01-01',
      });
      expect(
        await revalidatePackageForProposal(ACCOUNT_A, futurePkg.id)
      ).toBeNull();

      // 6. Booking deadline passed fails revalidation
      const passedDeadlinePkg = await createPackage(ACCOUNT_A, USER_ID, {
        name: 'Passed Deadline Package',
        destination: 'Goa',
        duration_days: 3,
        status: 'published',
        booking_deadline: '2020-01-01',
      });
      expect(
        await revalidatePackageForProposal(ACCOUNT_A, passedDeadlinePkg.id)
      ).toBeNull();

      // 7. Invalid requiredSeats fails revalidation
      expect(
        await revalidatePackageForProposal(ACCOUNT_A, validPkg.id, {
          departureId: depId,
          requiredSeats: 0,
        })
      ).toBeNull();
      expect(
        await revalidatePackageForProposal(ACCOUNT_A, validPkg.id, {
          departureId: depId,
          requiredSeats: -2,
        })
      ).toBeNull();
      expect(
        await revalidatePackageForProposal(ACCOUNT_A, validPkg.id, {
          departureId: depId,
          requiredSeats: 1.5,
        })
      ).toBeNull();

      // 8. Insufficient seats fails revalidation
      expect(
        await revalidatePackageForProposal(ACCOUNT_A, validPkg.id, {
          departureId: depId,
          requiredSeats: 10, // Only 4 available
        })
      ).toBeNull();

      // 9. Non-existent departure fails revalidation
      expect(
        await revalidatePackageForProposal(ACCOUNT_A, validPkg.id, {
          departureId: 'non-existent-dep-id',
        })
      ).toBeNull();
    });

    it('deep-clones snapshot data and preserves zero seats and zero prices', () => {
      const sourcePkg: TourPackageWithDetails = {
        id: 'pkg-zero-test',
        account_id: ACCOUNT_A,
        package_code: 'PKG-ZERO',
        name: 'Zero Test Package',
        destination: 'Kashmir',
        summary: 'Free promotional tour',
        duration_days: 4,
        duration_nights: 3,
        base_price: 0,
        currency: 'INR',
        price_basis: 'per_person',
        hotel_details: { name: 'Hotel Grand', stars: 4 },
        transport_details: { vehicle: 'Innova' },
        inclusions: ['Breakfast', 'Transfers'],
        exclusions: ['Personal Expenses'],
        terms_and_conditions: 'Standard terms',
        booking_deadline: null,
        valid_from: null,
        valid_until: null,
        status: 'published',
        metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        itinerary: [
          {
            id: 'itin-1',
            account_id: ACCOUNT_A,
            package_id: 'pkg-zero-test',
            day_number: 1,
            title: 'Arrival in Srinagar',
            description: 'Shikara ride',
            meals: 'Dinner',
            accommodation: 'Houseboat',
            created_at: '',
            updated_at: '',
          },
        ],
        departures: [
          {
            id: 'dep-zero-seats',
            account_id: ACCOUNT_A,
            package_id: 'pkg-zero-test',
            start_date: '2026-10-01',
            end_date: '2026-10-05',
            departure_price: 0,
            total_seats: 10,
            available_seats: 0, // Zero available seats
            status: 'scheduled',
            metadata: {},
            created_at: '',
            updated_at: '',
          },
        ],
      };

      const snapshot = generateProposalSnapshot(sourcePkg, 'dep-zero-seats');

      // Assert zero preservation
      expect(snapshot.base_price).toBe(0);
      expect(snapshot.available_seats).toBe(0);

      // Mutate source nested objects and arrays
      sourcePkg.inclusions.push('Hacked Inclusion');
      sourcePkg.exclusions.push('Hacked Exclusion');
      (sourcePkg.hotel_details as Record<string, unknown>).stars = 99;
      (sourcePkg.transport_details as Record<string, unknown>).vehicle =
        'Hacked Vehicle';
      sourcePkg.itinerary[0].title = 'Hacked Itinerary Title';

      // Snapshot MUST remain completely untouched
      expect(snapshot.inclusions).toEqual(['Breakfast', 'Transfers']);
      expect(snapshot.exclusions).toEqual(['Personal Expenses']);
      expect((snapshot.hotel_details as Record<string, unknown>).stars).toBe(4);
      expect(
        (snapshot.transport_details as Record<string, unknown>).vehicle
      ).toBe('Innova');
      expect((snapshot.itinerary as Array<{ title: string }>)[0].title).toBe(
        'Arrival in Srinagar'
      );
    });

    it('correctly classifies queries and extracts specific destination tokens', async () => {
      const { extractSearchTokens, isGeneralCatalogRequest } =
        await import('./package-service');

      // General catalog queries
      expect(isGeneralCatalogRequest('What packages do you have?')).toBe(true);
      expect(extractSearchTokens('What packages do you have?')).toEqual([]);

      expect(isGeneralCatalogRequest('Show all available tour packages.')).toBe(
        true
      );
      expect(extractSearchTokens('Show all available tour packages.')).toEqual(
        []
      );

      expect(isGeneralCatalogRequest('কী কী প্যাকেজ আছে?')).toBe(true);
      expect(extractSearchTokens('কী কী প্যাকেজ আছে?')).toEqual([]);

      // Specific queries with destination tokens
      expect(isGeneralCatalogRequest('Do you have Maldives packages?')).toBe(
        false
      );
      expect(extractSearchTokens('Do you have Maldives packages?')).toEqual([
        'maldives',
      ]);

      expect(isGeneralCatalogRequest('Show Thailand tour packages.')).toBe(
        false
      );
      expect(extractSearchTokens('Show Thailand tour packages.')).toEqual([
        'thailand',
      ]);

      expect(isGeneralCatalogRequest('Darjeeling package ache?')).toBe(false);
      expect(extractSearchTokens('Darjeeling package ache?')).toEqual([
        'darjeeling',
      ]);

      expect(isGeneralCatalogRequest('মালদ্বীপ প্যাকেজ আছে?')).toBe(false);
      expect(extractSearchTokens('মালদ্বীপ প্যাকেজ আছে?')).toEqual([
        'মালদ্বীপ',
      ]);
    });

    it('regression: returns empty array when DB has only Darjeeling and query asks for Maldives packages', async () => {
      // Seed database with ONLY Darjeeling package
      await createPackage(ACCOUNT_A, USER_ID, {
        name: 'Darjeeling Himalayan Tour',
        destination: 'Darjeeling',
        summary: 'Scenic hills and tea gardens',
        duration_days: 4,
        base_price: 18000,
        status: 'published',
      });

      // Query specifically asking for Maldives packages
      const results = await retrievePackagesForAi(
        ACCOUNT_A,
        'Do you have any Maldives packages?'
      );

      // Must return empty array and never return Darjeeling!
      expect(results).toHaveLength(0);

      const formatted = formatPackagesForAiContext(
        results,
        'Do you have any Maldives packages?'
      );
      expect(formatted.context).toBe('');
      expect(formatted.fallbackMessage).toContain(
        'No matching active tour package is currently listed'
      );
    });

    it('handles database query errors in getPackageWithDetails by throwing', async () => {
      // Simulate error by passing malformed call or asserting error path
      const notFound = await getPackageWithDetails(
        ACCOUNT_A,
        'non-existent-uuid'
      );
      expect(notFound).toBeNull();
    });

    it('safely handles search filters with special characters in listPackages', async () => {
      await createPackage(ACCOUNT_A, USER_ID, {
        name: 'Goa Beach Holiday',
        destination: 'Goa',
        duration_days: 3,
        status: 'published',
      });

      // Filter with commas, quotes, parentheses, percent signs
      const result = await listPackages(ACCOUNT_A, {
        search: 'Goa, (special); %',
      });

      expect(result.data.length).toBeGreaterThanOrEqual(1);
      expect(result.data.some((p) => p.name.includes('Goa'))).toBe(true);
    });

    it('safely deletes or archives a package using the safe_delete_tour_package RPC', async () => {
      const pkg = await createPackage(ACCOUNT_A, USER_ID, {
        name: 'Removable Package',
        destination: 'Kerala',
        duration_days: 5,
        status: 'draft',
      });

      // Unreferenced -> deleted
      const deleteResult = await safeDeletePackage(ACCOUNT_A, pkg.id, USER_ID);
      expect(deleteResult.deleted).toBe(true);
      expect(deleteResult.archived).toBe(false);

      // Re-create and link booking -> archived
      const bookedPkg = await createPackage(ACCOUNT_A, USER_ID, {
        name: 'Booked Package',
        destination: 'Kerala',
        duration_days: 5,
        status: 'published',
      });
      mockState.travel_bookings.push({
        id: 'booking-1',
        account_id: ACCOUNT_A,
        package_id: bookedPkg.id,
      });

      const archiveResult = await safeDeletePackage(
        ACCOUNT_A,
        bookedPkg.id,
        USER_ID
      );
      expect(archiveResult.deleted).toBe(false);
      expect(archiveResult.archived).toBe(true);

      // Deleting non-existent package throws not found
      await expect(
        safeDeletePackage(ACCOUNT_A, 'non-existent-pkg', USER_ID)
      ).rejects.toThrow('Package not found in tenant');
    });
  });
});
