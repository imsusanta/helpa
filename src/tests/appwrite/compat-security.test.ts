import { describe, expect, it } from 'vitest';
import { getRuntimeConfig } from '@/lib/runtime-config';

describe('Supabase-only provider invariant', () => {
  it('ignores legacy rollback environment variables', () => {
    expect(
      getRuntimeConfig({
        AUTH_PROVIDER: 'appwrite',
        DATABASE_PROVIDER: 'appwrite',
        MIGRATION_MODE: 'rollback',
      })
    ).toMatchObject({
      authProvider: 'supabase',
      databaseProvider: 'supabase',
      migrationMode: 'complete',
    });
  });
});
