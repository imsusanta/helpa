/**
 * Transitional client import facade.
 *
 * Existing components can keep their current import path while the runtime is
 * Supabase-only. This file performs no Appwrite network requests and imports no
 * Appwrite SDK.
 */
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import { createClient as createSupabaseBrowserClient } from '@/lib/supabase/client';

export type AppwriteCompatClient = SupabaseClient;
export type AppwriteClient = SupabaseClient;
export type AppwriteError = PostgrestError;

export function createClient(): AppwriteCompatClient {
  return createSupabaseBrowserClient();
}

/** @deprecated Use createClient; retained only for backward-compatible imports. */
export function createDataClient(
  _sessionOverride?: string,
  _useApiKey?: boolean
): AppwriteCompatClient {
  return createSupabaseBrowserClient();
}

/** @deprecated Browser code never receives a service-role client. */
export function appwriteAdmin(): AppwriteCompatClient {
  return createSupabaseBrowserClient();
}

/** @deprecated Browser code never receives a service-role client. */
export function getAdminClient(): AppwriteCompatClient {
  return createSupabaseBrowserClient();
}
