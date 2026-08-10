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
      '@supabase/supabase-js': path.resolve(
        __dirname,
        './src/lib/supabase/client.ts'
      ),
      '@supabase/ssr': path.resolve(
        __dirname,
        './src/lib/supabase/client.ts'
      ),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    // Dummy secrets — encryption.ts / webhook-signature.ts read these
    // at module load. Tests never hit a real Meta/Supabase service, so
    // any 32-byte hex / non-empty string will do; keep them lexically
    // identical to the CI build env so behaviour matches.
    env: {
      ENCRYPTION_KEY:
        '0000000000000000000000000000000000000000000000000000000000000000',
      META_APP_SECRET: 'test-meta-app-secret',
      NEXT_PUBLIC_SUPABASE_URL: 'https://helpa-test-project.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY:
        'test-service-role-key-secret-1234567890-abcdef',
    },
    clearMocks: true,
    setupFiles: ['./src/tests/setup.ts'],
  },
});
