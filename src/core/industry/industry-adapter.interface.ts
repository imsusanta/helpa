/**
 * Helpa Core Platform — Industry Adapter Interface
 *
 * Defines the contract for pure, deterministic industry adapters.
 * Adapters must be side-effect-free and have no dependencies on DB/Supabase clients,
 * network calls, or other industry adapters.
 */

export interface IndustryAdapter {
  /** Canonical identifier for this adapter */
  readonly id: string;

  /** Canonical industry ids handled by this adapter */
  readonly industryIds: readonly string[];

  /**
   * Industry-specific prompt rules (e.g. medical protocols, exam tracking rules,
   * booking confirm instructions).
   */
  getPromptRules(): string;

  /**
   * Specific critical override rules appended after the core business override.
   * Empty string if no custom override rules are needed.
   */
  getOverrideRules(): string;

  /**
   * Additional JSON schema fields for AI response extraction.
   */
  getJsonSchemaFields(): string[];

  /**
   * Mandatory intent fulfillment domain policy block.
   */
  getIntentPolicy(): string;

  /**
   * Section header used when injecting industry context into system prompts.
   * E.g. '=== HOSPITAL & CLINIC SYSTEM CONTEXT ==='
   */
  getContextSectionHeader(): string;
}
