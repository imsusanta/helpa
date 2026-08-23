import { describe, expect, it } from 'vitest';
import {
  getRuntimeConfig,
  RuntimeConfigurationError,
} from '@/lib/runtime-config';

describe('Supabase-only runtime configuration', () => {
  it('defaults to the canonical Supabase cutover architecture', () => {
    expect(getRuntimeConfig({ NODE_ENV: 'test' })).toEqual({
      authProvider: 'supabase',
      databaseProvider: 'supabase',
      migrationMode: 'cutover',
      production: false,
    });
  });

  it.each([
    [{ AUTH_PROVIDER: 'appwrite' }, 'auth provider'],
    [{ DATABASE_PROVIDER: 'appwrite' }, 'database provider'],
    [{ MIGRATION_MODE: 'rollback' }, 'rollback mode'],
    [{ MIGRATION_MODE: 'shadow' }, 'shadow mode'],
    [{ MIGRATION_MODE: 'off' }, 'off mode'],
  ])('rejects %s (%s)', (env, _label) => {
    expect(() => getRuntimeConfig(env)).toThrow(RuntimeConfigurationError);
  });
});
