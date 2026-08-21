import { ID, Query } from 'node-appwrite';
import { getAppwriteAdminClient } from '../server';
import { APPWRITE_CONFIG } from '../config';
import { createTenantPermissions } from '../permissions';

export interface LeadDocument {
  $id: string;
  accountId: string;
  contactId?: string;
  name: string;
  phone?: string;
  stage: string;
  assignedAgentId?: string;
  value?: number;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export class LeadsRepository {
  private get db() {
    return getAppwriteAdminClient().databases;
  }

  async listLeads(accountId: string): Promise<LeadDocument[]> {
    const res = await this.db.listDocuments(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.leads,
      [Query.equal('accountId', accountId), Query.limit(100)]
    );
    return res.documents as unknown as LeadDocument[];
  }

  async getLead(
    accountId: string,
    leadId: string
  ): Promise<LeadDocument | null> {
    try {
      const doc = await this.db.getDocument(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.leads,
        leadId
      );
      if ((doc as unknown as { accountId: string }).accountId !== accountId)
        return null;
      return doc as unknown as LeadDocument;
    } catch {
      return null;
    }
  }

  async createLead(
    accountId: string,
    data: Partial<LeadDocument>
  ): Promise<LeadDocument> {
    const permissions = createTenantPermissions(accountId);
    const now = new Date().toISOString();
    const doc = await this.db.createDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.leads,
      ID.unique(),
      {
        ...data,
        accountId,
        createdAt: now,
        updatedAt: now,
      },
      permissions
    );
    return doc as unknown as LeadDocument;
  }

  async updateStage(
    accountId: string,
    leadId: string,
    toStage: string,
    actorId: string,
    idempotencyKey?: string
  ): Promise<LeadDocument> {
    const now = new Date().toISOString();
    const effectiveKey =
      idempotencyKey || `lead_stage_${leadId}_${toStage}_${Date.now()}`;

    // 1. First attempt to record idempotency/command key BEFORE mutation
    try {
      await this.db.createDocument(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.idempotencyKeys,
        effectiveKey,
        {
          accountId,
          action: 'lead.stage_update',
          status: 'PENDING',
          createdAt: now,
        },
        createTenantPermissions(accountId)
      );
    } catch {
      if (idempotencyKey) {
        // Idempotency key already exists — check status
        try {
          const existingKey = await this.db.getDocument(
            APPWRITE_CONFIG.databaseId,
            APPWRITE_CONFIG.collections.idempotencyKeys,
            idempotencyKey
          );
          if (existingKey && existingKey.status === 'COMPLETED') {
            const existingLead = await this.getLead(accountId, leadId);
            if (existingLead) return existingLead;
          }
        } catch {
          // ignore lookup error
        }
        throw new Error(
          'A concurrent or duplicate stage transition request is already in progress.'
        );
      }
    }

    // 2. Fetch lead and verify tenant isolation
    const lead = await this.getLead(accountId, leadId);
    if (!lead) {
      this.updateIdempotencyStatus(effectiveKey, 'FAILED').catch(() => {});
      throw new Error('Lead not found in tenant');
    }

    const fromStage = lead.stage;

    // 3. Update lead stage
    const updated = await this.db.updateDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.leads,
      leadId,
      {
        stage: toStage,
        updatedAt: now,
      }
    );

    // 4. Record stage history & audit log concurrently
    await Promise.all([
      this.db
        .createDocument(
          APPWRITE_CONFIG.databaseId,
          APPWRITE_CONFIG.collections.leadStageHistory,
          ID.unique(),
          {
            accountId,
            leadId,
            fromStage,
            toStage,
            changedBy: actorId,
            createdAt: now,
          },
          createTenantPermissions(accountId)
        )
        .catch(() => {}),
      this.db
        .createDocument(
          APPWRITE_CONFIG.databaseId,
          APPWRITE_CONFIG.collections.auditLogs,
          ID.unique(),
          {
            accountId,
            actorId,
            action: 'lead.stage_update',
            resourceType: 'lead',
            resourceId: leadId,
            details: JSON.stringify({ fromStage, toStage }),
            createdAt: now,
          },
          createTenantPermissions(accountId)
        )
        .catch(() => {}),
    ]);

    // 5. Update idempotency state to COMPLETED
    await this.updateIdempotencyStatus(effectiveKey, 'COMPLETED').catch(
      () => {}
    );

    return updated as unknown as LeadDocument;
  }

  private async updateIdempotencyStatus(key: string, status: string) {
    try {
      await this.db.updateDocument(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.idempotencyKeys,
        key,
        { status }
      );
    } catch {
      // ignore status update failures
    }
  }
}

export const leadsRepository = new LeadsRepository();
