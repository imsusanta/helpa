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
import { getRuntimeConfig } from '@/lib/runtime-config';

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
  const config = getRuntimeConfig();
  if (config.databaseProvider === 'supabase') {
    return await createSupabaseServerClient();
  }
  if (config.migrationMode !== 'rollback') {
    throw new Error('APPWRITE_DATABASE_ACCESS_DISABLED');
  }
  return createDataClient(await sessionFromRequest(), false);
}

/** Server API-key / Service-Role client for trusted jobs, webhooks, and workers. */
export function appwriteAdmin(): AppwriteCompatClient {
  const config = getRuntimeConfig();
  if (config.databaseProvider === 'supabase') {
    return getSupabaseAdminClient();
  }
  if (config.migrationMode !== 'rollback') {
    throw new Error('APPWRITE_DATABASE_ACCESS_DISABLED');
  }
  return createDataClient(undefined, true);
}

export function getAdminClient(): AppwriteCompatClient {
  return appwriteAdmin();
}
