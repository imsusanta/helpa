/* eslint-disable @typescript-eslint/no-explicit-any */
declare module '@supabase/supabase-js' {
  export type SupabaseClient<_T = unknown> = any;
  export type PostgrestError = any;
  export type User = { id: string; email?: string; created_at?: string };
  export type RealtimeChannel = any;
  export function createClient(url: string, key: string, options?: any): any;
}

declare module '@supabase/ssr' {
  export function createBrowserClient(url: string, key: string): any;
  export function createServerClient(
    url: string,
    key: string,
    options?: any
  ): any;
}
