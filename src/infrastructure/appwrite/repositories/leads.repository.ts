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
    if (idempotencyKey) {
      try {
        const existingKey = await this.db.getDocument(
          APPWRITE_CONFIG.databaseId,
          APPWRITE_CONFIG.collections.idempotencyKeys,
          idempotencyKey
        );
        if (existingKey) {
          const lead = await this.getLead(accountId, leadId);
          if (lead) return lead;
        }
      } catch {
        // Proceed with execution
      }
    }

    const lead = await this.getLead(accountId, leadId);
    if (!lead) throw new Error('Lead not found in tenant');

    const fromStage = lead.stage;
    const now = new Date().toISOString();

    const updated = await this.db.updateDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.leads,
      leadId,
      {
        stage: toStage,
        updatedAt: now,
      }
    );

    // Record stage history
    await this.db.createDocument(
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
    );

    // Record audit log
    await this.db.createDocument(
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
    );

    if (idempotencyKey) {
      try {
        await this.db.createDocument(
          APPWRITE_CONFIG.databaseId,
          APPWRITE_CONFIG.collections.idempotencyKeys,
          idempotencyKey,
          {
            accountId,
            action: 'lead.stage_update',
            createdAt: now,
          },
          createTenantPermissions(accountId)
        );
      } catch {
        // Ignore duplicate key write
      }
    }

    return updated as unknown as LeadDocument;
  }
}

export const leadsRepository = new LeadsRepository();
