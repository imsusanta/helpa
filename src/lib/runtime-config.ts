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

/** Server-only provider selection. No request may infer or override this. */
export function getRuntimeConfig(env: NodeJS.ProcessEnv = process.env) {
  const production = env.NODE_ENV === 'production';
  const authProvider = enumValue(
    env.AUTH_PROVIDER || (env === process.env ? 'supabase' : undefined),
    ['supabase', 'appwrite'] as const,
    'AUTH_PROVIDER',
    production
  );
  const databaseProvider = enumValue(
    env.DATABASE_PROVIDER || (env === process.env ? 'supabase' : undefined),
    ['supabase', 'appwrite'] as const,
    'DATABASE_PROVIDER',
    production
  );
  const migrationMode = enumValue(
    env.MIGRATION_MODE ||
      (env === process.env ? 'cutover' : production ? undefined : 'off'),
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
  env: NodeJS.ProcessEnv = process.env
) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !publishableKey) {
    throw new RuntimeConfigurationError('SUPABASE_PUBLIC_CONFIG_MISSING');
  }

  return { url, publishableKey };
}

export function requireSupabaseServiceRole(
  env: NodeJS.ProcessEnv = process.env
) {
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new RuntimeConfigurationError('SUPABASE_SERVICE_ROLE_KEY_MISSING');
  }
  return serviceRoleKey;
}
