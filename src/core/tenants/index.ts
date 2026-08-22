/**
 * Helpa Core Platform — Multi-Tenant Isolation
 *
 * Enforces tenant boundary verification on database records and requests.
 */

import { ForbiddenError } from '@/lib/auth/account';

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
    throw new ForbiddenError(
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
