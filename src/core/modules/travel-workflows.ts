/**
 * Core-level registry for travel workflow seeds.
 *
 * The modules layer registers the config at startup (via
 * `registerTravelWorkflowsConfig`). The lib layer reads it here.
 * This avoids a direct `lib → modules` import.
 */

export interface TravelWorkflowSeed {
  seedKey: string;
  name: string;
  description: string;
  trigger_type: string;
  trigger_config: Record<string, unknown>;
  is_active: boolean;
  steps: Array<Record<string, unknown>>;
}

let config: TravelWorkflowSeed[] | null = null;

/** Populate the travel workflow seed config (call once at startup). */
export function registerTravelWorkflowsConfig(value: TravelWorkflowSeed[]): void {
  config = value;
}

/** Return the registered config, or an empty array if not yet registered. */
export function getTravelWorkflowsConfig(): TravelWorkflowSeed[] {
  return config ?? [];
}

/** Reset to unregistered state (tests only). */
export function resetTravelWorkflowsConfig(): void {
  config = null;
}
