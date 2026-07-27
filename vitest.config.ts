import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    // Dummy secrets — encryption.ts / webhook-signature.ts read these
    // at module load. Tests never hit a real Meta/Supabase service, so
    // any 32-byte hex / non-empty string will do; keep them lexically
    // identical to the CI build env so behaviour matches.
    env: {
      ENCRYPTION_KEY:
        "0000000000000000000000000000000000000000000000000000000000000000",
      META_APP_SECRET: "test-meta-app-secret",
      // signed-links.ts validates this at module load and throws when it is
      // missing, so any suite importing a route that signs patient links
      // needs it present. Deliberately different from ENCRYPTION_KEY — the
      // two must never be interchangeable.
      PDF_SIGNING_KEY:
        "1111111111111111111111111111111111111111111111111111111111111111",
    },
    clearMocks: true,
  },
});
