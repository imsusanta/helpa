/**
 * @deprecated Import from `@/lib/supabase/server` in new code.
 *
 * This path is retained temporarily to avoid a risky all-at-once import rename.
 * The implementation is Supabase-only: there is no Appwrite SDK, REST fallback,
 * cookie parsing, provider switch, or rollback mode behind this module.
 */
import {
  createClient as createSupabaseServerClient,
  getAdminClient as getSupabaseAdminClient,
} from '@/lib/supabase/server';

export type AppwriteCompatClient = ReturnType<typeof getSupabaseAdminClient>;
export type AppwriteClient = AppwriteCompatClient;
export type AppwriteError = {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
};

/** User-scoped Supabase client for Route Handlers and Server Components. */
export async function createClient() {
  return createSupabaseServerClient();
}

/** Privileged Supabase client for trusted jobs, webhooks, and workers. */
export function appwriteAdmin() {
  return getSupabaseAdminClient();
}

export function getAdminClient() {
  return getSupabaseAdminClient();
}
