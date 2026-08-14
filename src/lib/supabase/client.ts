import { createBrowserClient } from '@supabase/ssr';
import { requireSupabasePublicConfig } from '@/lib/runtime-config';

export function createClient() {
  const { url: supabaseUrl, publishableKey: supabaseAnonKey } =
    requireSupabasePublicConfig();

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
