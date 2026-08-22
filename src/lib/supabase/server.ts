import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import {
  requireSupabasePublicConfig,
  requireSupabaseServiceRole,
} from '@/lib/runtime-config';

export async function createClient() {
  const cookieStore = await cookies();
  const { url: supabaseUrl, publishableKey: supabaseAnonKey } =
    requireSupabasePublicConfig();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
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
          // Can be ignored if called from Server Component.
        }
      },
    },
  });
}

export function getAdminClient() {
  const { url: supabaseUrl } = requireSupabasePublicConfig();
  const serviceRoleKey = requireSupabaseServiceRole();

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
