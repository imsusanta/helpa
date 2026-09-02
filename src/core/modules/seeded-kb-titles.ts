/**
 * Core-level registry for seeded knowledge-base titles.
 *
 * The modules layer registers titles at startup (via
 * `registerSeededKbTitles`). The lib layer reads them here.
 * This avoids a direct `lib → modules` import.
 */

let titles: Set<string> | null = null;

/** Populate the set of seeded KB question titles (call once at startup). */
export function registerSeededKbTitles(value: Set<string>): void {
  titles = value;
}

/** Return the registered titles, or an empty set if not yet registered. */
export function getSeededKbTitles(): Set<string> {
  return titles ?? new Set<string>();
}

/** Reset to unregistered state (tests only). */
export function resetSeededKbTitles(): void {
  titles = null;
}
