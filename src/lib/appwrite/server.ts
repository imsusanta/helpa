import {
  createClient as createSupabaseServerClient,
  getAdminClient as getSupabaseAdminClient,
} from '@/lib/supabase/server';

/** @deprecated Use `getAdminClient` from `@/lib/supabase/server`. */
export function createAdminClient() {
  const client = getSupabaseAdminClient();
  return {
    account: client.auth.admin,
    databases: client,
    users: client.auth.admin,
  };
}

/** @deprecated Supabase sessions are read from HttpOnly cookies. */
export async function createSessionClient(_sessionSecret?: string) {
  const client = await createSupabaseServerClient();
  return { account: client.auth, databases: client };
}
