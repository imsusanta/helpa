/**
 * Browser-side database helper.
 *
 * Historical components imported `@/lib/appwrite-compat`. This module
 * returns the Supabase browser client only. The type is the real
 * Supabase client type so the fluent chain is type-checked; per-table
 * row types remain open until generated database types are introduced.
 */
import { createClient as createSupabaseBrowserClient } from '@/lib/supabase/client';

export type DbClient = ReturnType<typeof createSupabaseBrowserClient>;
/** @deprecated Use DbClient. Kept for remaining call-site imports. */
export type AppwriteClient = DbClient;

export function createClient(): DbClient {
  return createSupabaseBrowserClient();
}
