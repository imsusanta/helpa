import { cookies } from 'next/headers';
import {
  createDataClient,
  type AppwriteCompatClient,
  type AppwriteClient,
  type AppwriteError,
} from '@/lib/appwrite-compat';
import { APPWRITE_CONFIG } from '@/infrastructure/appwrite/config';
import {
  createClient as createSupabaseServerClient,
  getAdminClient as getSupabaseAdminClient,
} from '@/lib/supabase/server';

export type { AppwriteCompatClient, AppwriteClient, AppwriteError };

async function sessionFromRequest(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return (
    cookieStore.get(`a_session_${APPWRITE_CONFIG.projectId}`)?.value ||
    cookieStore.get('appwrite_session')?.value
  );
}

/** User-scoped client for Route Handlers and Server Components. */
export async function createClient(): Promise<AppwriteCompatClient> {
  if (
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    try {
      return await createSupabaseServerClient();
    } catch {
      // Fallback
    }
  }
  return createDataClient(await sessionFromRequest(), false);
}

/** Server API-key / Service-Role client for trusted jobs, webhooks, and workers. */
export function appwriteAdmin(): AppwriteCompatClient {
  if (
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    try {
      return getSupabaseAdminClient();
    } catch {
      // Fallback
    }
  }
  return createDataClient(undefined, true);
}

export function getAdminClient(): AppwriteCompatClient {
  return appwriteAdmin();
}
