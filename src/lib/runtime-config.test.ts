import { describe, expect, it } from 'vitest';
import {
  getRuntimeConfig,
  requireSupabasePublicConfig,
  requireSupabaseServiceRole,
  RuntimeConfigurationError,
} from './runtime-config';

describe('Supabase-only runtime configuration', () => {
  it('cannot be switched back to Appwrite by environment variables', () => {
    expect(
      getRuntimeConfig({
        NODE_ENV: 'production',
        AUTH_PROVIDER: 'appwrite',
        DATABASE_PROVIDER: 'appwrite',
        MIGRATION_MODE: 'rollback',
      })
    ).toEqual({
      authProvider: 'supabase',
      databaseProvider: 'supabase',
      migrationMode: 'complete',
      production: true,
    });
  });

  it('requires public Supabase configuration', () => {
    expect(() => requireSupabasePublicConfig({})).toThrow(
      RuntimeConfigurationError
    );
    expect(
      requireSupabasePublicConfig({
        NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'publishable-key',
      })
    ).toEqual({
      url: 'https://project.supabase.co',
      publishableKey: 'publishable-key',
    });
  });

  it('requires the service role for privileged server work', () => {
    expect(() => requireSupabaseServiceRole({})).toThrow(
      'MISSING_SUPABASE_SERVICE_ROLE_KEY'
    );
  });
});
