/**
 * Helpa Core Platform — Multi-Tenant Isolation
 *
 * Enforces tenant boundary verification on database records and requests.
 */

export function assertTenantMatch(
  recordAccountId: string,
  authenticatedAccountId: string,
  entityName: string = 'Record'
): void {
  if (
    !recordAccountId ||
    !authenticatedAccountId ||
    recordAccountId !== authenticatedAccountId
  ) {
    throw new Error(
      `Tenant Isolation Violation: ${entityName} does not belong to the active workspace.`
    );
  }
}

export function validateTenantPayload<T extends { account_id?: string }>(
  payload: T,
  authenticatedAccountId: string
): T {
  return {
    ...payload,
    account_id: authenticatedAccountId,
  };
}
