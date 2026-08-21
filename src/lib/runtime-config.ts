export type AuthProvider = 'supabase' | 'appwrite';
export type DatabaseProvider = 'supabase' | 'appwrite';
export type MigrationMode = 'off' | 'shadow' | 'cutover' | 'rollback';

export class RuntimeConfigurationError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'RuntimeConfigurationError';
  }
}

function enumValue<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
  name: string,
  isProduction: boolean
): T {
  if (value && (allowed as readonly string[]).includes(value)) {
    return value as T;
  }
  if (isProduction && !value) {
    throw new RuntimeConfigurationError(`INVALID_${name}`);
  }
  return allowed[0];
}

type EnvMap = Record<string, string | undefined>;

function requireEnvironmentValue(env: EnvMap, name: string): string {
  const value = env[name]?.trim();
  if (!value) {
    throw new RuntimeConfigurationError(`MISSING_${name}`);
  }
  return value;
}

/** Server-only provider selection. No request may infer or override this. */
export function getRuntimeConfig(
  env: EnvMap = process.env as unknown as EnvMap
) {
  const production = env.NODE_ENV === 'production';
  const authProvider = enumValue(
    env.AUTH_PROVIDER ||
      (env === (process.env as unknown) ? 'supabase' : undefined),
    ['supabase', 'appwrite'] as const,
    'AUTH_PROVIDER',
    production
  );
  const databaseProvider = enumValue(
    env.DATABASE_PROVIDER ||
      (env === (process.env as unknown) ? 'supabase' : undefined),
    ['supabase', 'appwrite'] as const,
    'DATABASE_PROVIDER',
    production
  );
  const migrationMode = enumValue(
    env.MIGRATION_MODE ||
      (env === (process.env as unknown)
        ? 'cutover'
        : production
          ? undefined
          : 'off'),
    ['cutover', 'shadow', 'off', 'rollback'] as const,
    'MIGRATION_MODE',
    production
  );

  if (
    production &&
    (authProvider !== 'supabase' || databaseProvider !== 'supabase')
  ) {
    throw new RuntimeConfigurationError('PRODUCTION_SUPABASE_CUTOVER_REQUIRED');
  }
  if (production && migrationMode !== 'cutover') {
    throw new RuntimeConfigurationError('PRODUCTION_CUTOVER_MODE_REQUIRED');
  }

  return { authProvider, databaseProvider, migrationMode, production };
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
