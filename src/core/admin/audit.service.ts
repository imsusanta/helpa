/** Helpa Core Super Admin — immutable administrative audit trail. */

import { randomUUID } from 'node:crypto';
import type { AdminAuditLog } from './types';
import { getAdminClient } from '@/lib/appwrite-server-compat';

function sanitizeMetadata(
  metadata: Record<string, unknown> | undefined
): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata || {})) {
    const normalized = key.toLowerCase();
    if (
      !/(token|secret|password|api.?key|credential|signature)/i.test(normalized)
    ) {
      safe[key] = value;
    }
  }
  return safe;
}

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
  const database = getAdminClient();
  const timestamp = new Date().toISOString();
  const safeMetadata = sanitizeMetadata(metadata);
  const record: AdminAuditLog = {
    id: randomUUID(),
    actorEmail,
    action,
    targetType,
    targetId,
    workspaceId,
    timestamp,
    metadata: safeMetadata,
  };

  const { error } = await database.from('audit_logs').insert({
    account_id: workspaceId || null,
    action: `admin:${action}`,
    target_type: targetType,
    target_id: targetId,
    metadata: {
      audit_id: record.id,
      actor_email: actorEmail,
      ...safeMetadata,
    },
    created_at: timestamp,
  });
  if (error) throw new Error(`ADMIN_AUDIT_WRITE_FAILED: ${error.message}`);
  return record;
}

export async function listAdminAuditLogs(filter?: {
  action?: string;
  targetType?: string;
  workspaceId?: string;
  limit?: number;
}): Promise<AdminAuditLog[]> {
  const database = getAdminClient();
  let query = database
    .from('audit_logs')
    .select('*')
    .ilike('action', 'admin:%')
    .order('created_at', { ascending: false })
    .limit(Math.min(Math.max(filter?.limit || 50, 1), 200));

  if (filter?.workspaceId) query = query.eq('account_id', filter.workspaceId);
  if (filter?.action) query = query.eq('action', `admin:${filter.action}`);
  if (filter?.targetType) query = query.eq('target_type', filter.targetType);

  const { data: rows, error } = await query;
  if (error) throw new Error(`ADMIN_AUDIT_READ_FAILED: ${error.message}`);

  return (rows || []).map((row) => {
    const metadata =
      (row.metadata as Record<string, unknown> | null) ||
      (row.details as Record<string, unknown> | null) ||
      {};
    return {
      id: String(metadata.audit_id || metadata.id || row.id),
      actorEmail: String(metadata.actor_email || metadata.actorEmail || ''),
      action: String(row.action || '').replace(/^admin:/, ''),
      targetType: (row.target_type ||
        metadata.targetType ||
        'system') as AdminAuditLog['targetType'],
      targetId: String(row.target_id || metadata.targetId || ''),
      workspaceId: row.account_id ? String(row.account_id) : undefined,
      timestamp: String(row.created_at || metadata.timestamp || ''),
      metadata,
    };
  });
}
