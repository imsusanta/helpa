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
    coverage: {
      provider: 'v8',
      reporter: ['json', 'html', 'text'],
      // Ratcheted minimum thresholds for security-critical modules (roadmap P1).
      // Values start ~5 points below measured coverage; raise as coverage grows.
      // Gaps still open (documented in 10-OUT-OF-10-ROADMAP.md): webhook route,
      // inbound persistence, process-status, tenant-resolver, outbox-service.
      thresholds: {
        'src/lib/whatsapp/encryption.ts': {
          statements: 88,
          lines: 88,
          functions: 95,
          branches: 68,
        },
        'src/core/security/tenant-guard.ts': {
          statements: 86,
          lines: 86,
          functions: 95,
          branches: 70,
        },
        'src/lib/auth/**': {
          statements: 79,
          lines: 79,
          functions: 90,
          branches: 68,
        },
        'src/lib/whatsapp/persist-outbound-message.ts': {
          statements: 72,
          lines: 72,
          functions: 88,
          branches: 68,
        },
      },
    },

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
      EVOLUTION_GO_BASE_URL: 'https://evolution.test',
      EVOLUTION_GO_GLOBAL_API_KEY: 'test-global-api-key',
      EVOLUTION_GO_WEBHOOK_BASE_URL: 'https://helpa.test',
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
