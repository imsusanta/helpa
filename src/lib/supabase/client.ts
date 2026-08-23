import { createBrowserClient } from '@supabase/ssr';
import { requireSupabasePublicConfig } from '@/lib/runtime-config';

export function createClient() {
  // Next.js only inlines NEXT_PUBLIC_* values referenced directly. Passing
  // process.env through the generic runtime resolver leaves browser bundles
  // without these values because dynamic environment lookups are not inlined.
  const { url: supabaseUrl, publishableKey: supabaseAnonKey } =
    requireSupabasePublicConfig({
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    });

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
