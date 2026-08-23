export type AuthProvider = 'supabase';
export type DatabaseProvider = 'supabase';
export type MigrationMode = 'cutover';

export class RuntimeConfigurationError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'RuntimeConfigurationError';
  }
}

type EnvMap = Record<string, string | undefined>;

function requireEnvironmentValue(env: EnvMap, name: string): string {
  const value = env[name]?.trim();
  if (!value) {
    throw new RuntimeConfigurationError(`MISSING_${name}`);
  }
  return value;
}

/**
 * Helpa has one runtime architecture: Supabase provides authentication and
 * application data, while Appwrite Sites is deployment hosting only.
 */
export function getRuntimeConfig(
  env: EnvMap = process.env as unknown as EnvMap
) {
  const authProvider = (env.AUTH_PROVIDER || 'supabase').trim().toLowerCase();
  const databaseProvider = (env.DATABASE_PROVIDER || 'supabase')
    .trim()
    .toLowerCase();
  const migrationMode = (env.MIGRATION_MODE || 'cutover').trim().toLowerCase();

  if (authProvider !== 'supabase') {
    throw new RuntimeConfigurationError('INVALID_AUTH_PROVIDER');
  }
  if (databaseProvider !== 'supabase') {
    throw new RuntimeConfigurationError('INVALID_DATABASE_PROVIDER');
  }
  if (migrationMode !== 'cutover') {
    throw new RuntimeConfigurationError('INVALID_MIGRATION_MODE');
  }

  return {
    authProvider: 'supabase' as const,
    databaseProvider: 'supabase' as const,
    migrationMode: 'cutover' as const,
    production: env.NODE_ENV === 'production',
  };
}

export function requireSupabasePublicConfig(
  env: EnvMap = process.env as unknown as EnvMap
) {
  const url = requireEnvironmentValue(env, 'NEXT_PUBLIC_SUPABASE_URL');
  const publishableKey = requireEnvironmentValue(
    env,
    'NEXT_PUBLIC_SUPABASE_ANON_KEY'
  );
  return { url, publishableKey };
}

export function requireSupabaseServiceRole(
  env: EnvMap = process.env as unknown as EnvMap
) {
  return requireEnvironmentValue(env, 'SUPABASE_SERVICE_ROLE_KEY');
}
