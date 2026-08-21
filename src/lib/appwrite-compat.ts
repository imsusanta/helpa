import { createClient as createSupabaseBrowserClient } from '@/lib/supabase/client';

/**
 * @deprecated Historical import path retained while call sites are renamed.
 * This module is Supabase-only and never calls an Appwrite endpoint.
 */
export type AppwriteCompatClient = ReturnType<
  typeof createSupabaseBrowserClient
>;
export type AppwriteClient = AppwriteCompatClient;
export type AppwriteError = {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
};

export function createClient(): AppwriteCompatClient {
  return createSupabaseBrowserClient();
}

export function createDataClient(
  _sessionOverride?: string,
  _useApiKey?: boolean
): AppwriteCompatClient {
  return createSupabaseBrowserClient();
}
