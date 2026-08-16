/**
 * Helpa Core Security — Security Incident & Event Monitoring
 *
 * Tracks unauthorized access attempts, IDOR probes, invalid signatures,
 * and security anomalies without leaking secret credentials.
 */

import { SecurityEvent } from './types';
import { getAdminClient } from '@/lib/appwrite-server-compat';
import { coreEvents } from '@/core/events';

export async function recordSecurityEvent(
  eventInput: Omit<SecurityEvent, 'id' | 'timestamp'>
): Promise<SecurityEvent> {
  const event: SecurityEvent = {
    id: `sec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    ...eventInput,
  };

  try {
    const db = getAdminClient();
    await db.from('audit_logs').insert({
      account_id: event.attemptedWorkspaceId || 'security_audit',
      action: `security:${event.type}`,
      details: {
        id: event.id,
        severity: event.severity,
        actorId: event.actorId,
        actorEmail: event.actorEmail,
        attemptedWorkspaceId: event.attemptedWorkspaceId,
        targetResourceId: event.targetResourceId,
        resourceType: event.resourceType,
        metadata: event.metadata,
        timestamp: event.timestamp,
      },
      created_at: event.timestamp,
    });
  } catch (err) {
    console.error(
      '[recordSecurityEvent] Failed to persist security event:',
      err
    );
  }

  // Emit event for alerting
  coreEvents.emit(
    'security.incident',
    event.attemptedWorkspaceId || 'platform',
    event
  );

  return event;
}
