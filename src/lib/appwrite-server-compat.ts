/**
 * @deprecated Import from `@/lib/supabase/server` in new code.
 * This compatibility import path is Supabase-only and contains no rollback.
 */
import {
  createClient as createSupabaseServerClient,
  getAdminClient as getSupabaseAdminClient,
} from '@/lib/supabase/server';

// Historical call sites use several builder shapes. Keep the boundary flexible
// while all returned objects remain real Supabase clients.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AppwriteCompatClient = any;
export type AppwriteClient = AppwriteCompatClient;
export type AppwriteError = {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
};

export async function createClient(): Promise<AppwriteCompatClient> {
  return createSupabaseServerClient();
}

export function appwriteAdmin(): AppwriteCompatClient {
  return getSupabaseAdminClient();
}

export function getAdminClient(): AppwriteCompatClient {
  return getSupabaseAdminClient();
}
