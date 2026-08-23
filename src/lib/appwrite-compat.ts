/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Transitional client import facade.
 *
 * Existing components can keep their current import path while the runtime is
 * Supabase-only. This file performs no Appwrite network requests and imports no
 * Appwrite SDK. The temporary `any` alias preserves the legacy fluent surface
 * while callers are migrated without changing runtime behavior.
 */
import { createClient as createSupabaseBrowserClient } from '@/lib/supabase/client';

export type AppwriteCompatClient = any;
export type AppwriteClient = AppwriteCompatClient;
export type AppwriteError = any;

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
