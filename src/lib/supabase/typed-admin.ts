import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

let _adminClient: SupabaseClient<Database> | null = null;

/**
 * Returns a strongly-typed Supabase client authenticated with the service role key.
 *
 * SECURITY INVARIANTS:
 * 1. Server-Only Boundary: Protected via 'server-only' import and runtime window check.
 *    Service-role credentials must NEVER be bundled into client-side code.
 * 2. RLS Bypass Awareness: Service-role operations bypass PostgreSQL Row Level Security.
 *    Every database operation on tenant-owned resources MUST explicitly include
 *    `.eq('account_id', accountId)` to maintain multi-tenant boundary isolation.
 * 3. Session Isolation: Session persistence and automatic token refresh are disabled.
 */
export function getAdminClient(): SupabaseClient<Database> {
  if (typeof window !== 'undefined') {
    throw new Error(
      'Security Violation: getAdminClient must only be executed in a server environment.'
    );
  }

  if (!_adminClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      throw new Error(
        'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.'
      );
    }

    _adminClient = createClient<Database>(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return _adminClient;
}
