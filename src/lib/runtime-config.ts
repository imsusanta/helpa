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
 * Helpa has completed its Supabase cutover. Provider selection is intentionally
 * not configurable at runtime: authentication and persistence always use
 * Supabase, and a request cannot override this invariant.
 */
export function getRuntimeConfig(
  env: EnvMap = process.env as unknown as EnvMap
) {
  return {
    authProvider: 'supabase' as const,
    databaseProvider: 'supabase' as const,
    migrationMode: 'complete' as const,
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
