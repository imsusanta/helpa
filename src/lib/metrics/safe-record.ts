import {
  recordOutcomeEvent,
  type OutcomeEventInput,
} from '@/lib/metrics/outcome-events';

function configuredTestTenantIds(): Set<string> {
  const raw = [process.env.HELPA_TEST_TENANT_IDS, process.env.DEMO_ACCOUNT_ID]
    .filter(Boolean)
    .join(',');
  return new Set(
    raw
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
  );
}

export function isConfiguredTestTenant(accountId: string): boolean {
  if (!accountId) return false;
  return configuredTestTenantIds().has(accountId);
}

export function isSyntheticObservationContext(): boolean {
  return process.env.DEMO_MODE === 'true';
}

/**
 * Fire-and-forget observation write. Never throws into the product path
 * and never accepts patient content — callers must pass opaque source IDs
 * and already-sanitized attributes.
 */
export function safeRecordOutcomeEvent(
  input: Omit<OutcomeEventInput, 'isSynthetic' | 'isTestTenant'> & {
    isSynthetic?: boolean;
    isTestTenant?: boolean;
  }
): void {
  // Vitest suites often mock global fetch and assert call counts. Observation
  // must never change those assertions or write to a real project from unit
  // tests. Set HELPA_RECORD_OUTCOME_EVENTS_IN_TEST=true to exercise inserts.
  if (
    process.env.VITEST === 'true' &&
    process.env.HELPA_RECORD_OUTCOME_EVENTS_IN_TEST !== 'true'
  ) {
    return;
  }
  void recordOutcomeEvent({
    ...input,
    isSynthetic: input.isSynthetic === true || isSyntheticObservationContext(),
    isTestTenant:
      input.isTestTenant === true || isConfiguredTestTenant(input.accountId),
  }).catch(() => undefined);
}
