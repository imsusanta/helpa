import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import {
  requireSupabasePublicConfig,
  requireSupabaseServiceRole,
} from '@/lib/runtime-config';

export async function createClient() {
  const cookieStore = await cookies();
  let supabaseUrl = 'https://tmqlzsyqlprioeoowmtk.supabase.co';
  let supabaseAnonKey =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRtcWx6c3lxbHByaW9lb293bXRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2OTQwNTcsImV4cCI6MjEwMjI3MDA1N30.NuZjQH0j5nBcR3AQLPa9SALiVO5RSO6GVPvnzS0-RDc';

  try {
    const config = requireSupabasePublicConfig();
    supabaseUrl = config.url;
    supabaseAnonKey = config.publishableKey;
  } catch {
    supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      'https://tmqlzsyqlprioeoowmtk.supabase.co';
    supabaseAnonKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRtcWx6c3lxbHByaW9lb293bXRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2OTQwNTcsImV4cCI6MjEwMjI3MDA1N30.NuZjQH0j5nBcR3AQLPa9SALiVO5RSO6GVPvnzS0-RDc';
  }

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
          // Can be ignored if called from Server Component
        }
      },
    },
  });
}

export function getAdminClient() {
  let supabaseUrl = 'https://tmqlzsyqlprioeoowmtk.supabase.co';
  let serviceRoleKey =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRtcWx6c3lxbHByaW9lb293bXRrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjY5NDA1NywiZXhwIjoyMTAyMjcwMDU3fQ.60b4HW1g3Th6psld5vgi_Aw1l-10R-KOzq-HWXmHHQ0';

  try {
    const config = requireSupabasePublicConfig();
    supabaseUrl = config.url;
    serviceRoleKey = requireSupabaseServiceRole();
  } catch {
    supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      'https://tmqlzsyqlprioeoowmtk.supabase.co';
    serviceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRtcWx6c3lxbHByaW9lb293bXRrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjY5NDA1NywiZXhwIjoyMTAyMjcwMDU3fQ.60b4HW1g3Th6psld5vgi_Aw1l-10R-KOzq-HWXmHHQ0';
  }

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
