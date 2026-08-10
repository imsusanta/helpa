import { ID, Query } from 'node-appwrite';
import { getAppwriteAdminClient } from '../server';
import { APPWRITE_CONFIG } from '../config';
import { createTenantPermissions } from '../permissions';

export interface IntegrationDocument {
  $id: string;
  accountId: string;
  provider:
    | 'calendly'
    | 'meta_whatsapp'
    | 'waha'
    | 'twilio'
    | 'exotel'
    | 'sarvam'
    | 'elevenlabs'
    | 'xai';
  credentialsEncrypted: string;
  status: 'active' | 'inactive' | 'error';
  createdAt: string;
  updatedAt: string;
}

export class IntegrationsRepository {
  private get db() {
    return getAppwriteAdminClient().databases;
  }

  async getIntegration(
    accountId: string,
    provider: string
  ): Promise<IntegrationDocument | null> {
    try {
      const res = await this.db.listDocuments(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.integrations,
        [
          Query.equal('accountId', accountId),
          Query.equal('provider', provider),
          Query.limit(1),
        ]
      );
      if (res.documents.length === 0) return null;
      return res.documents[0] as unknown as IntegrationDocument;
    } catch {
      return null;
    }
  }

  async saveIntegration(
    accountId: string,
    provider: string,
    credentialsEncrypted: string
  ): Promise<IntegrationDocument> {
    const existing = await this.getIntegration(accountId, provider);
    const now = new Date().toISOString();

    if (existing) {
      const updated = await this.db.updateDocument(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.integrations,
        existing.$id,
        {
          credentialsEncrypted,
          status: 'active',
          updatedAt: now,
        }
      );
      return updated as unknown as IntegrationDocument;
    }

    const created = await this.db.createDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.integrations,
      ID.unique(),
      {
        accountId,
        provider,
        credentialsEncrypted,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      },
      createTenantPermissions(accountId)
    );
    return created as unknown as IntegrationDocument;
  }
}

export const integrationsRepository = new IntegrationsRepository();
