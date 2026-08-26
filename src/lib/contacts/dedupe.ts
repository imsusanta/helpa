import type { AppwriteClient } from '@/lib/appwrite-compat';
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
  db: AppwriteClient,
  accountId: string,
  phone: string
): Promise<ExistingContact | null> {
  const digitsOnly = phone.replace(/\D/g, '');
  const normalized = normalizePhone(phone) || digitsOnly;
  if (!digitsOnly && !normalized) return null;

  const exactValues = new Set<string>();
  exactValues.add(phone.trim());
  if (digitsOnly) {
    exactValues.add(digitsOnly);
    exactValues.add(`+${digitsOnly}`);
  }
  if (normalized) {
    exactValues.add(normalized);
    exactValues.add(`+${normalized}`);
  }
  // India country code variants (91 prefix)
  if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
    const raw10 = digitsOnly.slice(2);
    exactValues.add(raw10);
    exactValues.add(`+${raw10}`);
    exactValues.add(`0${raw10}`);
  } else if (digitsOnly.length === 10 && /^[6-9]/.test(digitsOnly)) {
    exactValues.add(`91${digitsOnly}`);
    exactValues.add(`+91${digitsOnly}`);
    exactValues.add(`0${digitsOnly}`);
  }

  for (const accountField of ['account_id', 'accountId']) {
    for (const phoneField of ['phone_normalized', 'phone']) {
      for (const exactValue of Array.from(exactValues)) {
        try {
          const query = db
            .from('contacts')
            .select('*')
            .eq(accountField, accountId)
            .eq(phoneField, exactValue);
          const res =
            typeof (query as { limit?: unknown }).limit === 'function'
              ? await (
                  query as {
                    limit: (n: number) => Promise<{
                      data: ExistingContact[] | null;
                      error: unknown;
                    }>;
                  }
                ).limit(10)
              : await (query as Promise<{
                  data: ExistingContact[] | null;
                  error: unknown;
                }>);
          if (!res.error && res.data?.length) {
            const hit = (res.data as ExistingContact[]).find((candidate) =>
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

  const suffix = digitsOnly.length >= 8 ? digitsOnly.slice(-8) : digitsOnly;
  if (suffix.length >= 7) {
    for (const accountField of ['account_id', 'accountId']) {
      try {
        const query = db
          .from('contacts')
          .select('*')
          .eq(accountField, accountId)
          .like('phone', `%${suffix}`);
        const res =
          typeof (query as { limit?: unknown }).limit === 'function'
            ? await (
                query as {
                  limit: (n: number) => Promise<{
                    data: ExistingContact[] | null;
                    error: unknown;
                  }>;
                }
              ).limit(10)
            : await (query as Promise<{
                data: ExistingContact[] | null;
                error: unknown;
              }>);
        if (!res.error && res.data?.length) {
          const matched = (res.data as ExistingContact[]).filter((c) =>
            phonesMatch(c.phone, phone)
          );
          if (matched.length > 0) {
            const exact = matched.find((candidate) =>
              isExactMatch(candidate, phone)
            );
            if (exact) return exact;
            if (matched.length === 1) return matched[0];
          }
        }
      } catch {
        // Ignore
      }
    }
  }

  return null;
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
  if (!existing || !existing.phone || !phone) return false;
  const n1 =
    normalizePhone(existing.phone) || existing.phone.replace(/\D/g, '');
  const n2 = normalizePhone(phone) || phone.replace(/\D/g, '');
  if (n1 === n2) return true;
  if (n1.length === 12 && n1.startsWith('91') && n1.slice(2) === n2)
    return true;
  if (n2.length === 12 && n2.startsWith('91') && n2.slice(2) === n1)
    return true;
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
