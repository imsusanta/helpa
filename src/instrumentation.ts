/**
 * Next.js instrumentation hook — the server composition root.
 *
 * Runs once when a new Next.js server instance starts, before any request is
 * handled. Registers the modules-layer implementation of the Core industry
 * port so platform layers (`src/core`, `src/lib`) never import `src/modules`
 * directly.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { registerIndustryModulePort } = await import(
      './modules/industry-port'
    );
    registerIndustryModulePort();
  }
}