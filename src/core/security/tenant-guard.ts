/**
 * Helpa Core Security — Tenant Guard & IDOR Defense
 *
 * Mandatory server-side authorization check enforcing strict tenant isolation.
 * Guarantees Tenant A cannot read, write, or mutate Tenant B's data under any condition.
 */

import { ForbiddenError } from '@/lib/auth/account';
import { recordSecurityEvent } from './security-events';
import { TenantOwnershipCheck } from './types';

/**
 * Asserts that the authenticated user's workspace owns the target resource.
 * If there is any mismatch, records a security event and throws ForbiddenError.
 */
export async function assertTenantOwnership({
  authorizedWorkspaceId,
  resourceWorkspaceId,
  resourceType,
  resourceId,
}: TenantOwnershipCheck): Promise<boolean> {
  if (!authorizedWorkspaceId || !resourceWorkspaceId) {
    throw new ForbiddenError('Workspace authorization context missing');
  }

  if (authorizedWorkspaceId !== resourceWorkspaceId) {
    // Log security anomaly
    await recordSecurityEvent({
      type: 'tenant.cross_access_attempt',
      severity: 'high',
      attemptedWorkspaceId: authorizedWorkspaceId,
      targetResourceId: resourceId,
      resourceType,
      metadata: {
        attemptedByWorkspace: authorizedWorkspaceId,
        targetResourceOwnerWorkspace: resourceWorkspaceId,
      },
    });

    throw new ForbiddenError(
      `Access denied: Resource does not belong to your workspace (${resourceType})`
    );
  }

  return true;
}

/**
 * Validates that an incoming workspace ID matches the authenticated workspace ID.
 * Prevents client-side workspace_id tampering.
 */
export function validateWorkspaceContext(
  authenticatedWorkspaceId: string,
  requestedWorkspaceId?: string | null
): string {
  if (!requestedWorkspaceId) {
    return authenticatedWorkspaceId;
  }

  if (requestedWorkspaceId !== authenticatedWorkspaceId) {
    throw new ForbiddenError(
      'Unauthorized: Client workspace parameter does not match authenticated workspace'
    );
  }

  return authenticatedWorkspaceId;
}
