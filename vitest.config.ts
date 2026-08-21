import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      'server-only': path.resolve(
        __dirname,
        './src/tests/mocks/server-only.ts'
      ),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    env: {
      AUTH_PROVIDER: 'supabase',
      DATABASE_PROVIDER: 'supabase',
      MIGRATION_MODE: 'cutover',
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-supabase-anon-key',
      SUPABASE_SERVICE_ROLE_KEY: 'test-supabase-service-role-key',
      ENCRYPTION_KEY:
        '0000000000000000000000000000000000000000000000000000000000000000',
      META_APP_SECRET: 'test-meta-app-secret',
      NEXT_PUBLIC_APPWRITE_ENDPOINT: 'https://cloud.appwrite.io/v1',
      NEXT_PUBLIC_APPWRITE_PROJECT_ID: 'wacrm_test',
      APPWRITE_API_KEY: 'test-appwrite-api-key',
      PDF_SIGNING_KEY: 'test-pdf-signing-key-for-vitest',
      APPWRITE_DATABASE_ID: 'wacrm_test',
    },
    clearMocks: true,
    setupFiles: ['./src/tests/setup.ts'],
  },
});
