import { createClient as createSupabaseClient } from '@/lib/supabase/client';

/** @deprecated Supabase-only compatibility exports. */
export const client = createSupabaseClient();
export const account = client.auth;
export const databases = client;
