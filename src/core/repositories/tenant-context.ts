/**
 * Helpa Core Platform — Tenant-Scoped Repository Context
 *
 * Enforces mandatory tenant boundary identification.
 * Missing, null, or empty tenant contexts fail-closed before any database operation.
 */

export interface TenantContext {
  readonly accountId: string;
}

export class TenantContextError extends Error {
  constructor(
    message: string = 'Tenant context (accountId) is required and cannot be empty.'
  ) {
    super(message);
    this.name = 'TenantContextError';
    Object.setPrototypeOf(this, TenantContextError.prototype);
  }
}

/**
 * Asserts that the provided tenant context is valid and contains a non-empty accountId.
 * Fails closed immediately if invalid.
 */
export function assertTenantContext(
  context: TenantContext | null | undefined
): asserts context is TenantContext & { accountId: string } {
  if (
    !context ||
    typeof context !== 'object' ||
    typeof context.accountId !== 'string' ||
    !context.accountId.trim()
  ) {
    throw new TenantContextError(
      'Tenant context violation: missing or invalid accountId. Operation aborted fail-closed.'
    );
  }
}
