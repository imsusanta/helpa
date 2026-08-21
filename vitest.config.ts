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
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'src/lib/auth/**',
        'src/lib/whatsapp/encryption.ts',
        'src/lib/whatsapp/oauth-state.ts',
        'src/lib/whatsapp/webhook-verifier.ts',
        'src/lib/whatsapp/outbox-service.ts',
        'src/lib/whatsapp/meta-service.ts',
        'src/lib/billing/**',
        'src/lib/rate-limit.ts',
        'src/lib/csv-utils.ts',
      ],
      thresholds: {
        statements: 70,
        branches: 60,
        functions: 70,
        lines: 70,
      },
    },
  },
});
