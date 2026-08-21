import { createClient as createSupabaseClient } from '@/lib/supabase/client';

/** @deprecated Use `@/lib/supabase/client` directly. */
export function getAppwriteClient() {
  const client = createSupabaseClient();
  return {
    client,
    account: client.auth,
    databases: client,
    storage: client.storage,
  };
}
