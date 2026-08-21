/**
 * @deprecated Import from `@/lib/supabase/server` in new code.
 * This compatibility import path is Supabase-only and contains no rollback.
 */
import {
  createClient as createSupabaseServerClient,
  getAdminClient as getSupabaseAdminClient,
} from '@/lib/supabase/server';

export type AppwriteCompatClient = ReturnType<typeof getSupabaseAdminClient>;
export type AppwriteClient = AppwriteCompatClient;
export type AppwriteError = {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
};

export async function createClient() {
  return createSupabaseServerClient();
}

export function appwriteAdmin() {
  return getSupabaseAdminClient();
}

export function getAdminClient() {
  return getSupabaseAdminClient();
}
