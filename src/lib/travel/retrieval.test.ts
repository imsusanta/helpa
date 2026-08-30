import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  assertSameAccount,
  createTourPackage,
  deleteTourPackage,
  getTourPackageDetail,
  listTourPackages,
  matchTourPackagesForMessage,
  searchTourPackagesForAccount,
  updateTourPackage,
} from './retrieval';
import type { AdminClient } from '@/lib/db/server';

type Row = Record<string, unknown>;

function createMemoryDb(tables: Record<string, Row[]>) {
  const from = (table: string) => {
    if (!tables[table]) tables[table] = [];
    const store = tables[table];
    const filters: Array<(row: Row) => boolean> = [];
    let pendingUpdate: Row | null = null;
    let pendingDelete = false;
    let inserted: Row[] | null = null;
    let limitCount: number | null = null;
    const apply = () => {
      const matched = store.filter((row) =>
        filters.every((filter) => filter(row))
      );
      if (pendingUpdate) {
        matched.forEach((row) => Object.assign(row, pendingUpdate));
      }
      if (pendingDelete) {
        for (const row of matched) {
          const index = store.indexOf(row);
          if (index >= 0) store.splice(index, 1);
        }
      }
      const result =
        inserted || (pendingDelete ? matched : applyLimit(matched));
      return result;
    };
    const applyLimit = (matched: Row[]) =>
      limitCount == null ? matched : matched.slice(0, limitCount);

    const builder = {
      select: () => builder,
      eq: (field: string, value: unknown) => {
        filters.push((row) => row[field] === value);
        return builder;
      },
      ilike: (field: string, value: string) => {
        const needle = String(value).replace(/%/g, '').toLowerCase();
        filters.push((row) =>
          String(row[field] || '')
            .toLowerCase()
            .includes(needle)
        );
        return builder;
      },
      or: () => builder,
      in: (field: string, values: unknown[]) => {
        filters.push((row) => values.includes(row[field]));
        return builder;
      },
      order: () => builder,
      limit: (n: number) => {
        limitCount = n;
        return builder;
      },
      insert: (payload: Row | Row[]) => {
        const incoming = Array.isArray(payload) ? payload : [payload];
        inserted = incoming.map((row) => ({
          id: row.id || `id-${Math.random().toString(36).slice(2, 8)}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...row,
        }));
        store.push(...inserted);
        return builder;
      },
      update: (payload: Row) => {
        pendingUpdate = payload;
        return builder;
      },
      delete: () => {
        pendingDelete = true;
        return builder;
      },
      maybeSingle: async () => ({ data: apply()[0] || null, error: null }),
      single: async () => ({ data: apply()[0] || null, error: null }),
      then: (resolve: (value: { data: Row[]; error: null }) => unknown) =>
        resolve({ data: apply(), error: null }),
    };
    return builder;
  };

  return { from } as unknown as AdminClient;
}

const workspaceA = 'acc-travel-a';
const workspaceB = 'acc-travel-b';

const seed = {
  tour_packages: [
    {
      id: 'pkg-a',
      account_id: workspaceA,
      name: 'Kashmir Delight',
      destination: 'Kashmir',
      duration_days: 5,
      duration_nights: 4,
      starting_price: 27999,
      currency: 'INR',
      status: 'active',
      featured: true,
      valid_from: '2026-01-01',
      valid_until: '2026-12-31',
    },
    {
      id: 'pkg-b',
      account_id: workspaceB,
      name: 'Secret Kashmir',
      destination: 'Kashmir',
      duration_days: 5,
      duration_nights: 4,
      starting_price: 19999,
      currency: 'INR',
      status: 'active',
      featured: true,
      valid_from: '2026-01-01',
      valid_until: '2026-12-31',
    },
  ],
  tour_package_itineraries: [
    {
      id: 'it-a',
      account_id: workspaceA,
      package_id: 'pkg-a',
      day_number: 3,
      title: 'Gulmarg',
      description: 'Gondola',
    },
  ],
  tour_package_inclusions: [
    {
      id: 'inc-a',
      account_id: workspaceA,
      package_id: 'pkg-a',
      item: 'Hotel and breakfast',
    },
  ],
  tour_package_exclusions: [],
  tour_package_hotels: [],
  tour_package_pricing: [
    {
      id: 'pr-a',
      account_id: workspaceA,
      package_id: 'pkg-a',
      adults: 2,
      children: 1,
      price: 62000,
      currency: 'INR',
    },
  ],
  tour_package_departures: [
    {
      id: 'dep-a',
      account_id: workspaceA,
      package_id: 'pkg-a',
      departure_date: '2026-09-15',
      available_seats: 8,
      status: 'open',
      currency: 'INR',
    },
  ],
};

describe('tour package retrieval isolation', () => {
  let db: AdminClient;

  beforeEach(() => {
    db = createMemoryDb(structuredClone(seed));
  });

  it('never treats another workplace row as the current account', () => {
    expect(assertSameAccount(workspaceA, workspaceB)).toBe(false);
    expect(assertSameAccount(workspaceA, workspaceA)).toBe(true);
  });

  it('CASE 1/7: lists only the current Travel Workplace packages', async () => {
    const rows = await listTourPackages(db, workspaceA);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.name).toBe('Kashmir Delight');
    expect(rows.some((row) => row.account_id === workspaceB)).toBe(false);
  });

  it('CASE 2: matches budget + Kashmir + 5 days from the current workspace', async () => {
    const result = await matchTourPackagesForMessage(
      db,
      workspaceA,
      'Budget 30k, Kashmir 5 days.'
    );
    expect(result.retrievalFailed).toBe(false);
    expect(result.matches.map((row) => row.package.name)).toEqual([
      'Kashmir Delight',
    ]);
    expect(result.matches[0]?.package.account_id).toBe(workspaceA);
  });

  it('CASE 7: another workplace matching package is never returned', async () => {
    const result = await matchTourPackagesForMessage(
      db,
      workspaceA,
      'Kashmir package ache?'
    );
    const names = [...result.matches, ...result.nearMatches].map(
      (row) => row.package.name
    );
    expect(names).not.toContain('Secret Kashmir');
    const leaked = await searchTourPackagesForAccount(db, workspaceA, {
      destination: 'Kashmir',
      budget: null,
      durationDays: null,
      durationNights: null,
      adults: null,
      children: null,
      packageType: null,
      category: null,
      travelMonth: null,
      travelDate: null,
      itineraryDay: null,
      inclusionQuery: null,
      query: 'Kashmir',
      packageIntent: true,
    });
    expect(leaked.every((row) => row.account_id === workspaceA)).toBe(true);
  });

  it('CASE 6: returns no invented package when nothing matches', async () => {
    const result = await matchTourPackagesForMessage(
      db,
      workspaceA,
      'Andaman luxury yacht package ache?'
    );
    expect(result.matches).toEqual([]);
  });

  it('creates, updates, retrieves, and deletes a package inside one workspace', async () => {
    const created = await createTourPackage(db, workspaceA, {
      name: 'Sikkim Family',
      destination: 'Sikkim',
      duration_days: 4,
      duration_nights: 3,
      starting_price: 22000,
      itineraries: [
        { day_number: 1, title: 'Gangtok', description: 'Mall road' },
      ],
      inclusions: [{ item: 'Hotel' }],
      exclusions: [{ item: 'Airfare' }],
    });
    expect(created.account_id).toBe(workspaceA);
    expect(created.name).toBe('Sikkim Family');

    const fetched = await getTourPackageDetail(db, workspaceA, created.id);
    expect(fetched?.destination).toBe('Sikkim');

    const updated = await updateTourPackage(db, workspaceA, created.id, {
      name: 'Sikkim Family Plus',
      destination: 'Sikkim',
      duration_days: 5,
      starting_price: 24000,
    });
    expect(updated?.name).toBe('Sikkim Family Plus');
    expect(updated?.duration_days).toBe(5);
    expect(updated?.inclusions.map((row) => row.item)).toEqual(['Hotel']);
    expect(updated?.itineraries[0]?.title).toBe('Gangtok');

    const otherWorkspace = await getTourPackageDetail(
      db,
      workspaceB,
      created.id
    );
    expect(otherWorkspace).toBeNull();

    expect(await deleteTourPackage(db, workspaceB, created.id)).toBe(false);
    expect(await deleteTourPackage(db, workspaceA, created.id)).toBe(true);
    expect(await getTourPackageDetail(db, workspaceA, created.id)).toBeNull();
  });

  it('preserves status, featured, catalog fields, and occupancy pricing on a simple edit', async () => {
    const created = await createTourPackage(db, workspaceA, {
      name: 'Sikkim Featured',
      destination: 'Sikkim',
      duration_days: 4,
      starting_price: 22000,
      status: 'inactive',
      featured: true,
      package_type: 'Family',
      category: 'Domestic',
      booking_notes: 'Keep this note',
      pricing: [{ pricing_name: '2A1C', adults: 2, children: 1, price: 62000 }],
    });
    expect(created.status).toBe('inactive');
    expect(created.featured).toBe(true);

    const updated = await updateTourPackage(db, workspaceA, created.id, {
      name: 'Sikkim Featured Plus',
      destination: 'Sikkim',
      duration_days: 5,
      starting_price: 24000,
    });
    expect(updated?.name).toBe('Sikkim Featured Plus');
    expect(updated?.status).toBe('inactive');
    expect(updated?.featured).toBe(true);
    expect(updated?.package_type).toBe('Family');
    expect(updated?.category).toBe('Domestic');
    expect(updated?.booking_notes).toBe('Keep this note');
    expect(updated?.pricing).toHaveLength(1);
    expect(updated?.pricing[0]?.price).toBe(62000);
    expect(updated?.pricing[0]?.adults).toBe(2);
  });

  it('finds a package by name instead of scanning an arbitrary first page', async () => {
    const named = await createTourPackage(db, workspaceA, {
      name: 'Hidden Kashmir Special',
      destination: 'Kashmir',
      starting_price: 18000,
    });
    const byName = await searchTourPackagesForAccount(
      db,
      workspaceA,
      {
        destination: null,
        budget: null,
        durationDays: null,
        durationNights: null,
        adults: null,
        children: null,
        packageType: null,
        category: null,
        travelMonth: null,
        travelDate: null,
        itineraryDay: null,
        inclusionQuery: null,
        query: 'Hidden Kashmir Special',
        packageIntent: true,
      },
      { name: 'Hidden Kashmir Special' }
    );
    expect(byName.map((row) => row.id)).toContain(named.id);
    expect(byName.every((row) => row.name.includes('Hidden Kashmir'))).toBe(
      true
    );
  });

  it('retries create when an optional alias column is missing', async () => {
    const inner = createMemoryDb({
      tour_packages: [],
      tour_package_itineraries: [],
      tour_package_inclusions: [],
      tour_package_exclusions: [],
      tour_package_hotels: [],
      tour_package_pricing: [],
      tour_package_departures: [],
    });
    let insertAttempts = 0;
    const dbWithMissingColumn = {
      from: (table: string) => {
        const builder = inner.from(table) as {
          insert: (payload: Row) => unknown;
        };
        if (table !== 'tour_packages') return builder;
        const originalInsert = builder.insert.bind(builder);
        builder.insert = (payload: Row) => {
          insertAttempts += 1;
          if (insertAttempts === 1) {
            return {
              select: () => ({
                single: async () => ({
                  data: null,
                  error: {
                    code: 'PGRST204',
                    message:
                      "Could not find the 'cover_image_url' column of 'tour_packages' in the schema cache",
                  },
                }),
              }),
            };
          }
          return originalInsert(payload);
        };
        return builder;
      },
    } as unknown as AdminClient;

    const created = await createTourPackage(dbWithMissingColumn, workspaceA, {
      name: 'Goa Weekend',
      destination: 'Goa',
      starting_price: 15999,
      cover_image_url: 'https://example.com/goa.jpg',
    });
    expect(created.name).toBe('Goa Weekend');
    expect(insertAttempts).toBe(2);
  });
});

describe('tour package retrieval errors', () => {
  it('marks retrievalFailed instead of inventing prices', async () => {
    const db = {
      from: () => ({
        select: () => ({
          eq: () => ({
            limit: async () => ({
              data: null,
              error: { message: 'relation does not exist' },
            }),
          }),
        }),
      }),
    } as unknown as AdminClient;

    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await matchTourPackagesForMessage(
      db,
      workspaceA,
      'Kashmir package ache?'
    );
    spy.mockRestore();
    expect(result.retrievalFailed).toBe(true);
    expect(result.matches).toEqual([]);
  });
});
