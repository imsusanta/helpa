export type AuthProvider = 'supabase' | 'appwrite';
export type DatabaseProvider = 'supabase' | 'appwrite';
export type MigrationMode = 'off' | 'shadow' | 'cutover' | 'rollback';

export class RuntimeConfigurationError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'RuntimeConfigurationError';
  }
}

const DEFAULT_SUPABASE_URL = 'https://tmqlzsyqlprioeoowmtk.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRtcWx6c3lxbHByaW9lb293bXRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2OTQwNTcsImV4cCI6MjEwMjI3MDA1N30.NuZjQH0j5nBcR3AQLPa9SALiVO5RSO6GVPvnzS0-RDc';
const DEFAULT_SUPABASE_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRtcWx6c3lxbHByaW9lb293bXRrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjY5NDA1NywiZXhwIjoyMTAyMjcwMDU3fQ.60b4HW1g3Th6psld5vgi_Aw1l-10R-KOzq-HWXmHHQ0';

/** Server-only provider selection. No request may infer or override this. */
export function getRuntimeConfig(env: NodeJS.ProcessEnv = process.env) {
  const production = env.NODE_ENV === 'production';
  const authProvider: AuthProvider =
    (env.AUTH_PROVIDER as AuthProvider) || 'supabase';
  const databaseProvider: DatabaseProvider =
    (env.DATABASE_PROVIDER as DatabaseProvider) || 'supabase';
  const migrationMode: MigrationMode =
    (env.MIGRATION_MODE as MigrationMode) || 'cutover';

  return { authProvider, databaseProvider, migrationMode, production };
}

export function requireSupabasePublicConfig(
  env: NodeJS.ProcessEnv = process.env
) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const publishableKey =
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;
  return { url, publishableKey };
}

export function requireSupabaseServiceRole(
  env: NodeJS.ProcessEnv = process.env
) {
  const serviceRoleKey =
    env.SUPABASE_SERVICE_ROLE_KEY || DEFAULT_SUPABASE_SERVICE_ROLE_KEY;
  return serviceRoleKey;
}
