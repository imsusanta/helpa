import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import {
  requireSupabasePublicConfig,
  requireSupabaseServiceRole,
} from '@/lib/runtime-config';

interface ServerClientOptions {
  /** When false, authentication cookies expire with the browser session. */
  persistentSession?: boolean;
}

export async function createClient(options: ServerClientOptions = {}) {
  const cookieStore = await cookies();
  const { url: supabaseUrl, publishableKey: supabaseAnonKey } =
    requireSupabasePublicConfig();
  const persistentSession = options.persistentSession !== false;

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options: cookieOptions }) => {
            const normalizedOptions = persistentSession
              ? cookieOptions
              : {
                  ...cookieOptions,
                  expires: undefined,
                  maxAge: undefined,
                };
            cookieStore.set(name, value, normalizedOptions);
          });
        } catch {
          // Server Components cannot write cookies. The proxy refreshes them.
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
