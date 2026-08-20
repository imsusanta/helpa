import { createClient as createSupabaseClient } from '@/lib/supabase/client';

/**
 * Transitional data-client alias for legacy UI modules.
 *
 * The application now uses Supabase as its only auth/database provider.
 * This module intentionally contains no Appwrite SDK, endpoint, or API-key logic.
 */
export function createClient() {
  return createSupabaseClient();
}

export type AppwriteCompatClient = ReturnType<typeof createClient>;
export type AppwriteClient = AppwriteCompatClient;
export type AppwriteError = Error;
