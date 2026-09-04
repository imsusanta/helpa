import type { DbClient } from '@/lib/db/client';
import { normalizePhone, phonesMatch } from '@/lib/whatsapp/phone-utils';

/**
 * Contact de-duplication helpers, shared by the WhatsApp webhook, the
 * manual contact form, and CSV import so all paths agree on what
 * "same number" means (issue #212).
 *
 * The canonical key is `normalizePhone` (digits-only) — the same form
 * the DB stores in the generated `contacts.phone_normalized` column
 * and enforces unique per account. `phonesMatch` adds trunk-prefix
 * tolerance (last-8-digit match) for the softer "possible duplicate"
 * surfaces.
 */

/** Canonical de-dup key for a phone string (digits only). */
export function normalizeKey(phone: string): string {
  return normalizePhone(phone);
}

/** Minimal shape we need back from a contacts lookup. */
export interface ExistingContact {
  id: string;
  phone: string;
  name?: string | null;
  [key: string]: unknown;
}

/**
 * Find an existing contact in `accountId` whose phone matches `phone`,
 * or null. Exact normalized matches are always preferred. A suffix query
 * remains as a controlled legacy fallback for numbers stored with a trunk
 * prefix, but it is never allowed to outrank an exact match.
 */
export async function findExistingContact(
  db: DbClient,
  accountId: string,
  phone: string
): Promise<ExistingContact | null> {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;

  // Exact lookups must happen before the suffix fallback. A suffix match is
  // intentionally fuzzy (it tolerates trunk prefixes), so it is ambiguous
  // when two contacts share the same final eight digits. Older installations
  // may not have `phone_normalized`; raw `phone` equality is the compatible
  // fallback and still gives exact matches precedence.
  const exactValues = [...new Set([phone, normalized])];
  for (const accountField of ['account_id', 'accountId']) {
    for (const phoneField of ['phone_normalized', 'phone']) {
      for (const exactValue of phoneField === 'phone_normalized'
        ? [normalized]
        : exactValues) {
        try {
          const query = db
            .from('contacts')
            .select('*')
            .eq(accountField, accountId)
            .eq(phoneField, exactValue);
          const exact = await query.limit(10);
          if (!exact.error && exact.data?.length) {
            const hit = (exact.data as ExistingContact[]).find((candidate) =>
              isExactMatch(candidate, phone)
            );
            if (hit) return hit;
          }
        } catch {
          // Continue through the alternate schema/query shapes.
        }
      }
    }
  }

  const suffix = normalized.length >= 8 ? normalized.slice(-8) : normalized;
  let data: ExistingContact[] | null = null;
  let error: unknown = null;

  try {
    const res = await db
      .from('contacts')
      .select('*')
      .eq('account_id', accountId)
      .like('phone', `%${suffix}`);
    data = res.data as ExistingContact[] | null;
    error = res.error;
  } catch {
    // Fallback to camelCase
    try {
      const res = await db
        .from('contacts')
        .select('*')
        .eq('accountId', accountId)
        .like('phone', `%${suffix}`);
      data = res.data as ExistingContact[] | null;
      error = res.error;
    } catch {
      // Ignore
    }
  }

  if (error || !data) return null;

  const matched = (data as ExistingContact[]).filter((c) =>
    phonesMatch(c.phone, phone)
  );
  if (matched.length === 0) return null;

  const exact = matched.find((candidate) => isExactMatch(candidate, phone));
  if (exact) return exact;

  // A suffix-only match is intentionally fuzzy (it tolerates trunk-prefix
  // differences). When more than one contact shares that suffix, there is no
  // safe way to infer the owner of an inbound reply. Returning an arbitrary
  // "primary" or oldest row can leak messages across contacts, so fail closed
  // and let the caller surface the routing problem for correction.
  return matched.length === 1 ? matched[0] : null;
}

/**
 * True when an existing contact is an *exact* normalized match for
 * `phone` (vs only a fuzzy trunk-variant match). The form hard-blocks
 * exact matches but only warns on fuzzy ones.
 */
export function isExactMatch(
  existing: ExistingContact,
  phone: string
): boolean {
  return normalizeKey(existing.phone) === normalizeKey(phone);
}

/**
 * True for a Postgres unique-constraint violation (SQLSTATE 23505).
 * Used as the backstop when the DB unique index rejects a racing or
 * format-equal insert that slipped past the in-app check.
 */
export function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  return (error as { code?: string }).code === '23505';
}

/**
 * De-duplicate parsed CSV rows by normalized phone, keeping the first
 * occurrence of each. Rows with an empty normalized phone are dropped
 * (they can't be a valid contact). Returns the unique rows plus the
 * count removed as in-file duplicates.
 */
export function dedupeByPhone<T extends { phone: string }>(
  rows: T[]
): { unique: T[]; duplicates: number } {
  const seen = new Set<string>();
  const unique: T[] = [];
  let duplicates = 0;

  for (const row of rows) {
    const key = normalizeKey(row.phone);
    if (!key) {
      duplicates++;
      continue;
    }
    if (seen.has(key)) {
      duplicates++;
      continue;
    }
    seen.add(key);
    unique.push(row);
  }

  return { unique, duplicates };
}
