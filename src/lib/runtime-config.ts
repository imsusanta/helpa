export type AuthProvider = 'supabase' | 'appwrite';
export type DatabaseProvider = 'supabase' | 'appwrite';
export type MigrationMode = 'off' | 'shadow' | 'cutover' | 'rollback';

export interface RuntimeConfig {
  authProvider: AuthProvider;
  databaseProvider: DatabaseProvider;
  migrationMode: MigrationMode;
  production: boolean;
}

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
 * Helpa has one valid runtime architecture: Supabase provides authentication
 * and application data, while Appwrite Sites is deployment hosting only.
 * The wider union types are retained temporarily so legacy guard branches can
 * be removed incrementally; prohibited values always fail here.
 */
export function getRuntimeConfig(
  env: EnvMap = process.env as unknown as EnvMap
): RuntimeConfig {
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
    authProvider: 'supabase',
    databaseProvider: 'supabase',
    migrationMode: 'cutover',
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
