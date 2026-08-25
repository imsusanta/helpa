/**
 * Server-side database helpers.
 *
 * Historical route handlers imported `@/lib/appwrite-server-compat`.
 * This module is the renamed facade and returns only Supabase clients.
 * The public client types stay `any` so remaining fluent call sites can
 * migrate without a repo-wide PostgREST typing pass.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  createClient as createSupabaseServerClient,
  getAdminClient as getSupabaseAdminClient,
} from '@/lib/supabase/server';

export type AdminClient = any;
export type UserClient = any;
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
