import { ID, Query } from 'node-appwrite';
import { getAppwriteAdminClient } from '../server';
import { APPWRITE_CONFIG } from '../config';
import { createTenantPermissions } from '../permissions';

export interface AuditLogDocument {
  $id: string;
  accountId: string;
  actorId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  details?: string;
  createdAt: string;
}

export class AuditLogsRepository {
  private get db() {
    return getAppwriteAdminClient().databases;
  }

  async listAuditLogs(accountId: string): Promise<AuditLogDocument[]> {
    const res = await this.db.listDocuments(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.auditLogs,
      [
        Query.equal('accountId', accountId),
        Query.orderDesc('createdAt'),
        Query.limit(100),
      ]
    );
    return res.documents as unknown as AuditLogDocument[];
  }

  async createAuditLog(
    accountId: string,
    actorId: string,
    action: string,
    resourceType: string,
    resourceId: string,
    details?: Record<string, unknown>
  ): Promise<AuditLogDocument> {
    const now = new Date().toISOString();
    const doc = await this.db.createDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.auditLogs,
      ID.unique(),
      {
        accountId,
        actorId,
        action,
        resourceType,
        resourceId,
        details: details ? JSON.stringify(details) : '',
        createdAt: now,
      },
      createTenantPermissions(accountId)
    );
    return doc as unknown as AuditLogDocument;
  }
}

export const auditLogsRepository = new AuditLogsRepository();
