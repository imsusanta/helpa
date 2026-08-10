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
      APPWRITE_DATABASE_ID: 'wacrm_test',
    },
    clearMocks: true,
    setupFiles: ['./src/tests/setup.ts'],
  },
});
