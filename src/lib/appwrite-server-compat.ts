/**
 * Transitional import facade.
 *
 * Historical route handlers import this module by name. It now returns only
 * Supabase clients; no Appwrite database, auth, storage, cookie, or SDK path
 * exists behind this facade. Callers can be renamed incrementally without a
 * broad application rewrite.
 */
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import {
  createClient as createSupabaseServerClient,
  getAdminClient as getSupabaseAdminClient,
} from '@/lib/supabase/server';

export type AppwriteCompatClient = SupabaseClient;
export type AppwriteClient = SupabaseClient;
export type AppwriteError = PostgrestError;

/** User-scoped Supabase client for Route Handlers and Server Components. */
export async function createClient(): Promise<AppwriteCompatClient> {
  return await createSupabaseServerClient();
}

/** Supabase service-role client for trusted server-only work. */
export function appwriteAdmin(): AppwriteCompatClient {
  return getSupabaseAdminClient();
}

export function getAdminClient(): AppwriteCompatClient {
  return getSupabaseAdminClient();
}
