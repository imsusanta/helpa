import { describe, expect, it } from 'vitest';
import {
  getRuntimeConfig,
  RuntimeConfigurationError,
} from '@/lib/runtime-config';

describe('Supabase-only runtime configuration', () => {
  it('uses Supabase and cutover mode by default', () => {
    expect(getRuntimeConfig({ NODE_ENV: 'test' })).toEqual({
      authProvider: 'supabase',
      databaseProvider: 'supabase',
      migrationMode: 'cutover',
      production: false,
    });
  });

  it.each([
    [{ AUTH_PROVIDER: 'appwrite' }, 'INVALID_AUTH_PROVIDER'],
    [{ DATABASE_PROVIDER: 'appwrite' }, 'INVALID_DATABASE_PROVIDER'],
    [{ MIGRATION_MODE: 'rollback' }, 'INVALID_MIGRATION_MODE'],
    [{ MIGRATION_MODE: 'shadow' }, 'INVALID_MIGRATION_MODE'],
  ])('fails closed for prohibited runtime configuration', (env, code) => {
    expect(() => getRuntimeConfig(env)).toThrowError(
      expect.objectContaining<Partial<RuntimeConfigurationError>>({ code })
    );
  });
});
