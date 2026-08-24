import { describe, expect, it } from 'vitest';
import type { AppwriteClient } from '@/lib/appwrite-compat';
import {
  dedupeByPhone,
  findExistingContact,
  isExactMatch,
  isUniqueViolation,
  normalizeKey,
} from './dedupe';

describe('normalizeKey', () => {
  it('strips every non-digit', () => {
    expect(normalizeKey('+1 (555) 123-4567')).toBe('15551234567');
    expect(normalizeKey('15551234567')).toBe('15551234567');
  });

  it('collapses different formats of the same number to one key', () => {
    expect(normalizeKey('+44 7911 123456')).toBe(normalizeKey('447911123456'));
  });
});

describe('isExactMatch', () => {
  it('treats different formatting of the same digits as exact', () => {
    expect(
      isExactMatch({ id: '1', phone: '+1 555-123-4567' }, '15551234567')
    ).toBe(true);
  });

  it('is false for a trunk-variant (fuzzy) match', () => {
    // last-8 match but not the same full number
    expect(
      isExactMatch({ id: '1', phone: '37063949836' }, '370063949836')
    ).toBe(false);
  });
});

describe('isUniqueViolation', () => {
  it('detects Postgres 23505', () => {
    expect(isUniqueViolation({ code: '23505' })).toBe(true);
  });
  it('is false for other errors / non-objects', () => {
    expect(isUniqueViolation({ code: '23502' })).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation('boom')).toBe(false);
  });
});

describe('dedupeByPhone', () => {
  it('keeps the first occurrence and counts in-file duplicates', () => {
    const { unique, duplicates } = dedupeByPhone([
      { phone: '+1 555-1111', name: 'A' },
      { phone: '15551111', name: 'B' }, // same digits as #1
      { phone: '+1 555-2222', name: 'C' },
    ]);
    expect(unique.map((r) => r.name)).toEqual(['A', 'C']);
    expect(duplicates).toBe(1);
  });

  it('drops rows with no digits', () => {
    const { unique, duplicates } = dedupeByPhone([
      { phone: '   ' },
      { phone: '+1 555-3333' },
    ]);
    expect(unique).toHaveLength(1);
    expect(duplicates).toBe(1);
  });
});

describe('findExistingContact', () => {
  // Minimal AppwriteClient stub: resolves the .from().select().eq().like()
  // chain to a fixed candidate set.
  function stubDb(rows: Array<{ id: string; phone: string }>): AppwriteClient {
    const builder = {
      select: () => builder,
      eq: () => builder,
      like: () => Promise.resolve({ data: rows, error: null }),
    };
    return { from: () => builder } as unknown as AppwriteClient;
  }

  it('returns a trunk-variant match via phonesMatch', async () => {
    const db = stubDb([{ id: 'c1', phone: '37063949836' }]);
    const hit = await findExistingContact(db, 'acct', '+370 063 949 836');
    expect(hit?.id).toBe('c1');
  });

  it('prefers an exact contact when another contact shares the fuzzy suffix', async () => {
    const rows = [
      { id: 'suffix-only', phone: '991234567890' },
      { id: 'exact', phone: '141234567890' },
    ];
    const builder = {
      filters: [] as Array<[string, unknown]>,
      select() {
        return this;
      },
      eq(field: string, value: unknown) {
        this.filters.push([field, value]);
        return this;
      },
      limit: async () => {
        const normalized = String(
          builder.filters.find(
            ([field]) => field === 'phone_normalized'
          )?.[1] || ''
        );
        const rawPhone = String(
          builder.filters.find(([field]) => field === 'phone')?.[1] || ''
        );
        const data =
          normalized || rawPhone
            ? rows.filter((row) =>
                normalized
                  ? normalizeKey(row.phone) === normalized
                  : row.phone === rawPhone
              )
            : [];
        return { data, error: null };
      },
      like: async () => ({ data: rows, error: null }),
    };
    const db = {
      from: () => {
        builder.filters = [];
        return builder;
      },
    } as unknown as AppwriteClient;

    const hit = await findExistingContact(db, 'acct', '+1 412 345 67890');
    expect(hit?.id).toBe('exact');
  });

  it('returns null when no candidate matches', async () => {
    const db = stubDb([{ id: 'c1', phone: '15559999999' }]);
    const hit = await findExistingContact(db, 'acct', '+1 555-123-4567');
    expect(hit).toBeNull();
  });

  it('fails closed when multiple contacts share only the fuzzy suffix', async () => {
    const db = stubDb([
      { id: 'c1', phone: '37063949836' },
      { id: 'c2', phone: '44063949836' },
    ]);
    const hit = await findExistingContact(db, 'acct', '+370 063 949 836');
    expect(hit).toBeNull();
  });

  it('returns null for an empty phone without querying', async () => {
    const db = stubDb([{ id: 'c1', phone: '15551234567' }]);
    expect(await findExistingContact(db, 'acct', '   ')).toBeNull();
  });
});
