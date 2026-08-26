/**
 * Server-side database helpers.
 *
 * Historical route handlers imported `@/lib/appwrite-server-compat`.
 * This module is the renamed facade and returns only Supabase clients.
 *
 * The client types are the real Supabase client types, so the fluent
 * query-builder chain is type-checked. Per-table row types remain open
 * (`any` rows) until generated database types are introduced; tightening
 * those is a follow-up that does not change this module's surface.
 */
import {
  createClient as createSupabaseServerClient,
  getAdminClient as getSupabaseAdminClient,
} from '@/lib/supabase/server';

export type AdminClient = ReturnType<typeof getSupabaseAdminClient>;
export type UserClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/** PostgREST / RPC error shape used by account-management helpers. */
export type DbError = {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
};

/** @deprecated Use AdminClient. Kept for remaining call-site imports. */
export type AppwriteClient = AdminClient;
/** @deprecated Use DbError. Kept for remaining call-site imports. */
export type AppwriteError = DbError;

/** User-scoped Supabase client for Route Handlers and Server Components. */
export async function createClient(): Promise<UserClient> {
  return await createSupabaseServerClient();
}

/** Service-role Supabase client for trusted server-only work. */
export function getAdminClient(): AdminClient {
  return getSupabaseAdminClient();
}
