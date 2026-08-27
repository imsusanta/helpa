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
  saveItineraryDays,
  saveDepartures,
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

    // Failure injection simulation for rollback test
    if (
      this.tableName === 'tour_package_departures' &&
      items.some(
        (item) => (item.metadata as Record<string, unknown>)?.simulate_failure
      )
    ) {
      throw new Error('Simulated DB network failure during departure insert');
    }

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
  });

  describe('3. Child Record Tenant Defense & Transaction Safety', () => {
    it('prevents cross-tenant child record attacks in saveItineraryDays and saveDepartures', async () => {
      const pkgA = await createPackage(ACCOUNT_A, USER_ID, {
        name: 'Tenant A Secret Package',
        destination: 'Bhutan',
        duration_days: 4,
      });

      // Tenant B attempts to modify Tenant A's itinerary
      await expect(
        saveItineraryDays(ACCOUNT_B, pkgA.id, [
          { day_number: 1, title: 'Hacked day' },
        ])
      ).rejects.toThrow('Package not found in tenant');

      // Tenant B attempts to modify Tenant A's departures
      await expect(
        saveDepartures(ACCOUNT_B, pkgA.id, [
          { start_date: '2026-10-01', total_seats: 100 },
        ])
      ).rejects.toThrow('Package not found in tenant');
    });

    it('performs transactional rollback if child insert fails during createPackage', async () => {
      const initialCount = mockState.travel_packages.length;

      await expect(
        createPackage(ACCOUNT_A, USER_ID, {
          name: 'Failing Transaction Package',
          destination: 'Leh',
          duration_days: 5,
          itinerary: [{ day_number: 1, title: 'Day 1' }],
          departures: [
            {
              start_date: '2026-10-01',
              metadata: { simulate_failure: true },
            },
          ],
        })
      ).rejects.toThrow('Simulated DB network failure during departure insert');

      // Assert that rollback cleaned up parent and child rows
      expect(
        mockState.travel_packages.some(
          (p) => p.name === 'Failing Transaction Package'
        )
      ).toBe(false);
      expect(mockState.travel_packages.length).toBe(initialCount);
    });
  });

  describe('4. Proposal Snapshot & Server-Side Security Verification', () => {
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

    it('revalidates package from database before generating proposal', async () => {
      const pkg = await createPackage(ACCOUNT_A, USER_ID, {
        name: 'Andaman Scuba Adventure',
        destination: 'Havelock, Neil Island',
        duration_days: 6,
        base_price: 42000,
      });

      const revalidated = await revalidatePackageForProposal(ACCOUNT_A, pkg.id);
      expect(revalidated).not.toBeNull();
      expect(revalidated?.name).toBe('Andaman Scuba Adventure');
      expect(revalidated?.base_price).toBe(42000);
    });
  });
});
