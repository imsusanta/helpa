import { cookies } from 'next/headers';
import {
  createDataClient,
  type AppwriteCompatClient,
  type AppwriteClient,
  type AppwriteError,
} from '@/lib/appwrite-compat';
import { APPWRITE_CONFIG } from '@/infrastructure/appwrite/config';

export type { AppwriteCompatClient, AppwriteClient, AppwriteError };

async function sessionFromRequest(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return (
    cookieStore.get(`a_session_${APPWRITE_CONFIG.projectId}`)?.value ||
    cookieStore.get('appwrite_session')?.value
  );
}

/** User-scoped Appwrite client for Route Handlers and Server Components. */
export async function createClient(): Promise<AppwriteCompatClient> {
  return createDataClient(await sessionFromRequest(), false);
}

/** Server API-key client for trusted jobs, webhooks, and workers. */
export function appwriteAdmin(): AppwriteCompatClient {
  return createDataClient(undefined, true);
}

export function getAdminClient(): AppwriteCompatClient {
  return appwriteAdmin();
}
