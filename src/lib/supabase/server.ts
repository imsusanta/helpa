import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import {
  requireSupabasePublicConfig,
  requireSupabaseServiceRole,
} from '@/lib/runtime-config';

/** User-scoped Supabase client backed by the request's HttpOnly auth cookies. */
export async function createClient() {
  const cookieStore = await cookies();
  const { url, publishableKey } = requireSupabasePublicConfig();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Server Components cannot write cookies. Route Handlers and the
          // proxy refresh session cookies when a write-capable context exists.
        }
      },
    },
  });
}

/**
 * Privileged Supabase client for trusted jobs and webhooks only.
 * Configuration fails closed; credentials are never embedded in source.
 */
export function getAdminClient() {
  const { url } = requireSupabasePublicConfig();
  const serviceRoleKey = requireSupabaseServiceRole();

  return createSupabaseClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
