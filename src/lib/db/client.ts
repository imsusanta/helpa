/**
 * Browser-side database helper.
 *
 * Historical components imported `@/lib/appwrite-compat`. This module
 * returns the Supabase browser client only. The public type stays `any`
 * so remaining fluent call sites compile during the incremental rename.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient as createSupabaseBrowserClient } from '@/lib/supabase/client';

export type DbClient = any;
/** @deprecated Use DbClient. Kept for remaining call-site imports. */
export type AppwriteClient = DbClient;

export function createClient(): DbClient {
  return createSupabaseBrowserClient();
}
