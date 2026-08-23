/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Transitional import facade.
 *
 * Historical route handlers import this module by name. It now returns only
 * Supabase clients; no Appwrite database, auth, storage, cookie, or SDK path
 * exists behind this facade. The temporary `any` alias preserves legacy fluent
 * typing while routes are migrated incrementally.
 */
import {
  createClient as createSupabaseServerClient,
  getAdminClient as getSupabaseAdminClient,
} from '@/lib/supabase/server';

export type AppwriteCompatClient = any;
export type AppwriteClient = AppwriteCompatClient;
export type AppwriteError = any;

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
