/**
 * Helpa Core Security Layer — Types & Interfaces
 */

export interface SecurityEvent {
  id: string;
  type:
    | 'auth.failed_login'
    | 'auth.unauthorized_access'
    | 'tenant.cross_access_attempt'
    | 'tenant.idor_attempt'
    | 'webhook.invalid_signature'
    | 'rate_limit.exceeded'
    | 'admin.unauthorized_action'
    | 'ai.prompt_injection_attempt';
  severity: 'low' | 'medium' | 'high' | 'critical';
  actorId?: string;
  actorEmail?: string;
  attemptedWorkspaceId?: string;
  targetResourceId?: string;
  resourceType?: string;
  ip?: string;
  userAgent?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface TenantOwnershipCheck {
  authorizedWorkspaceId: string;
  resourceWorkspaceId: string;
  resourceType: string;
  resourceId?: string;
}
