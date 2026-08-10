import { ID, Query } from 'node-appwrite';
import { APPWRITE_CONFIG } from '../config';
import { getAppwriteAdminClient } from '../server';

export interface VoiceIntegrationDocument {
  $id: string;
  accountId: string;
  provider: string;
  encryptedCredentialsReference: string;
  agentId: string;
  providerPhoneNumberId: string;
  phoneNumberMasked?: string;
  status: 'configured' | 'disabled' | 'error';
  capabilities?: string[];
}

export class VoiceRepository {
  private get db() {
    return getAppwriteAdminClient().databases;
  }

  async findUniqueTenant(
    provider: string,
    agentId?: string,
    phoneNumberId?: string
  ): Promise<VoiceIntegrationDocument | null> {
    const queries = [Query.equal('provider', provider), Query.limit(10)];
    if (agentId) queries.push(Query.equal('agentId', agentId));
    if (phoneNumberId)
      queries.push(Query.equal('providerPhoneNumberId', phoneNumberId));
    const result = await this.db.listDocuments(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.voiceIntegrations,
      queries
    );
    if (result.documents.length !== 1) return null;
    return result.documents[0] as unknown as VoiceIntegrationDocument;
  }

  async findIntegration(
    accountId: string,
    provider: string
  ): Promise<VoiceIntegrationDocument | null> {
    const result = await this.db.listDocuments(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.voiceIntegrations,
      [
        Query.equal('accountId', accountId),
        Query.equal('provider', provider),
        Query.equal('status', 'configured'),
        Query.limit(2),
      ]
    );
    return result.documents.length === 1
      ? (result.documents[0] as unknown as VoiceIntegrationDocument)
      : null;
  }

  async createProviderEvent(data: Record<string, unknown>) {
    return this.db.createDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.providerEvents,
      ID.unique(),
      data
    );
  }

  async findProviderEvent(provider: string, externalEventId: string) {
    const result = await this.db.listDocuments(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.providerEvents,
      [
        Query.equal('provider', provider),
        Query.equal('externalEventId', externalEventId),
        Query.limit(1),
      ]
    );
    return result.documents[0] || null;
  }

  async upsertCall(
    accountId: string,
    externalCallId: string,
    data: Record<string, unknown>
  ) {
    const existing = await this.db.listDocuments(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.calls,
      [
        Query.equal('accountId', accountId),
        Query.equal('externalCallId', externalCallId),
        Query.limit(1),
      ]
    );
    if (existing.documents[0])
      return this.db.updateDocument(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.calls,
        existing.documents[0].$id,
        { ...data, updatedAt: new Date().toISOString() }
      );
    return this.db.createDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.calls,
      ID.unique(),
      {
        accountId,
        externalCallId,
        ...data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    );
  }

  async createCommand(data: Record<string, unknown>) {
    return this.db.createDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.voiceCommands,
      ID.unique(),
      data
    );
  }

  async updateCommand(commandId: string, data: Record<string, unknown>) {
    return this.db.updateDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.voiceCommands,
      commandId,
      { ...data, updatedAt: new Date().toISOString() }
    );
  }

  async findCommand(accountId: string, idempotencyKey: string) {
    const result = await this.db.listDocuments(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.voiceCommands,
      [
        Query.equal('accountId', accountId),
        Query.equal('idempotencyKey', idempotencyKey),
        Query.limit(1),
      ]
    );
    return result.documents[0] || null;
  }
}

export const voiceRepository = new VoiceRepository();
