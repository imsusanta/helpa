/**
 * Canonical hosted Helpa database.
 *
 * The Next.js app never hardcodes this URL — browser and API clients read
 * NEXT_PUBLIC_SUPABASE_URL. Operator scripts fall back here only when that
 * env var is unset, so they cannot silently hit a retired project.
 */
export const CANONICAL_PRODUCTION_SUPABASE_PROJECT_REF = 'zsxhtcprjllesptvxlyq';
export const CANONICAL_PRODUCTION_SUPABASE_URL = `https://${CANONICAL_PRODUCTION_SUPABASE_PROJECT_REF}.supabase.co`;

const RETIRED_SUPABASE_PROJECT_REFS = ['tmqlzsyqlprioeoowmtk'];

export function assertNotRetiredSupabaseUrl(url) {
  const lower = String(url || '').toLowerCase();
  for (const ref of RETIRED_SUPABASE_PROJECT_REFS) {
    if (lower.includes(ref)) {
      throw new Error(
        `RETIRED_SUPABASE_PROJECT: ${ref} is no longer the Helpa database. Use ${CANONICAL_PRODUCTION_SUPABASE_URL}`
      );
    }
  }
}

export function resolveSupabaseUrl(env = process.env) {
  const url = (
    env.NEXT_PUBLIC_SUPABASE_URL || CANONICAL_PRODUCTION_SUPABASE_URL
  ).trim();
  assertNotRetiredSupabaseUrl(url);
  return url;
}
