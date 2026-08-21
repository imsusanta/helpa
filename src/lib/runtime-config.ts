export class RuntimeConfigurationError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'RuntimeConfigurationError';
  }
}

type EnvMap = Record<string, string | undefined>;

export interface RuntimeConfig {
  authProvider: 'supabase' | 'appwrite';
  databaseProvider: 'supabase' | 'appwrite';
  migrationMode: 'complete' | 'rollback';
  production: boolean;
}

function requireEnvironmentValue(env: EnvMap, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new RuntimeConfigurationError(`MISSING_${name}`);
  return value;
}

/** Authentication and persistence are permanently Supabase-only. */
export function getRuntimeConfig(
  env: EnvMap = process.env as unknown as EnvMap
): RuntimeConfig {
  return {
    authProvider: 'supabase',
    databaseProvider: 'supabase',
    migrationMode: 'complete',
    production: env.NODE_ENV === 'production',
  };
}

export function requireSupabasePublicConfig(
  env: EnvMap = process.env as unknown as EnvMap
) {
  return {
    url: requireEnvironmentValue(env, 'NEXT_PUBLIC_SUPABASE_URL'),
    publishableKey: requireEnvironmentValue(
      env,
      'NEXT_PUBLIC_SUPABASE_ANON_KEY'
    ),
  };
}

export function requireSupabaseServiceRole(
  env: EnvMap = process.env as unknown as EnvMap
) {
  return requireEnvironmentValue(env, 'SUPABASE_SERVICE_ROLE_KEY');
}
