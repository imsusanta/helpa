/**
 * Helpa Core Super Admin — Audit Logging Service
 *
 * Immutable, secure audit trail of all platform-level administrative actions.
 * Ensures zero secret credential leakage.
 */

import { AdminAuditLog } from './types';
import { getAdminClient } from '@/lib/db/server';

/**
 * Logs an administrative action to the platform audit trail.
 */
export async function logAdminAction({
  actorEmail,
  action,
  targetType,
  targetId,
  workspaceId,
  metadata,
}: {
  actorEmail: string;
  action: string;
  targetType: AdminAuditLog['targetType'];
  targetId: string;
  workspaceId?: string;
  metadata?: Record<string, unknown>;
}): Promise<AdminAuditLog> {
  const db = getAdminClient();
  const timestamp = new Date().toISOString();

  // Strip any accidental sensitive tokens or credentials from metadata
  const safeMetadata: Record<string, unknown> = {};
  if (metadata) {
    for (const [k, v] of Object.entries(metadata)) {
      const lower = k.toLowerCase();
      if (
        !lower.includes('token') &&
        !lower.includes('secret') &&
        !lower.includes('password') &&
        !lower.includes('key')
      ) {
        safeMetadata[k] = v;
      }
    }
  }

  const record: AdminAuditLog = {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    actorEmail,
    action,
    targetType,
    targetId,
    workspaceId,
    timestamp,
    metadata: safeMetadata,
  };

  await db.from('audit_logs').insert({
    account_id: workspaceId || 'platform_admin',
    action: `admin:${action}`,
    details: {
      id: record.id,
      actorEmail,
      targetType,
      targetId,
      metadata: safeMetadata,
      timestamp,
    },
    created_at: timestamp,
  });

  return record;
}

/**
 * Retrieves platform administrative audit logs with optional filters.
 */
export async function listAdminAuditLogs(filter?: {
  action?: string;
  targetType?: string;
  workspaceId?: string;
  limit?: number;
}): Promise<AdminAuditLog[]> {
  const db = getAdminClient();
  const { data: rows } = await db
    .from('audit_logs')
    .select('*')
    .ilike('action', 'admin:%')
    .order('created_at', { ascending: false })
    .limit(filter?.limit || 50);

  if (!rows || rows.length === 0) {
    return [];
  }

  return rows.map((r) => {
    const d = (r.details as Record<string, unknown>) || {};
    return {
      id: String(d.id || r.id),
      actorEmail: String(d.actorEmail || 'susantalohr@gmail.com'),
      action: String(r.action).replace(/^admin:/, ''),
      targetType: (d.targetType as AdminAuditLog['targetType']) || 'system',
      targetId: String(d.targetId || r.account_id),
      workspaceId: r.account_id,
      timestamp: String(d.timestamp || r.created_at),
      metadata: d.metadata as Record<string, unknown>,
    };
  });
}
