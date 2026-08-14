import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    'https://tmqlzsyqlprioeoowmtk.supabase.co';
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRtcWx6c3lxbHByaW9lb293bXRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2OTQwNTcsImV4cCI6MjEwMjI3MDA1N30.NuZjQH0j5nBcR3AQLPa9SALiVO5RSO6GVPvnzS0-RDc';

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
