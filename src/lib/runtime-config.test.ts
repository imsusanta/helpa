import { describe, expect, it } from 'vitest';
import { getRuntimeConfig, RuntimeConfigurationError } from './runtime-config';

describe('runtime provider configuration', () => {
  it('fails closed when production provider selection is missing', () => {
    expect(() => getRuntimeConfig({ NODE_ENV: 'production' })).toThrow(
      RuntimeConfigurationError
    );
  });

  it('accepts only an explicit Supabase production cutover', () => {
    expect(
      getRuntimeConfig({
        NODE_ENV: 'production',
        AUTH_PROVIDER: 'supabase',
        DATABASE_PROVIDER: 'supabase',
        MIGRATION_MODE: 'cutover',
      })
    ).toMatchObject({ authProvider: 'supabase', databaseProvider: 'supabase' });
  });

  it('does not permit Appwrite as a silent production fallback', () => {
    expect(() =>
      getRuntimeConfig({
        NODE_ENV: 'production',
        AUTH_PROVIDER: 'appwrite',
        DATABASE_PROVIDER: 'appwrite',
        MIGRATION_MODE: 'rollback',
      })
    ).toThrow('PRODUCTION_SUPABASE_CUTOVER_REQUIRED');
  });
});
