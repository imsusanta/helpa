/**
 * Industry terminology & aliases — moved to the Core industry contract
 * (`src/core/modules/terminology.ts`) so platform layers (`src/core`,
 * `src/lib`) can consume them without depending on the modules layer.
 *
 * This file remains as a compatibility re-export for UI consumers
 * (`src/app`, `src/components`, `src/hooks`).
 */

export * from '@/core/modules/terminology';
