import { ID, Query } from 'node-appwrite';
import { getAppwriteAdminClient } from '../server';
import { APPWRITE_CONFIG } from '../config';

export interface ProviderEventDocument {
  $id: string;
  accountId?: string;
  provider: string;
  eventType: string;
  eventId: string;
  payload: string;
  processed: boolean;
  createdAt: string;
}

export class ProviderEventsRepository {
  private get db() {
    return getAppwriteAdminClient().databases;
  }

  async isDuplicateEvent(provider: string, eventId: string): Promise<boolean> {
    try {
      const res = await this.db.listDocuments(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.providerEvents,
        [
          Query.equal('provider', provider),
          Query.equal('eventId', eventId),
          Query.limit(1),
        ]
      );
      return res.documents.length > 0;
    } catch {
      return false;
    }
  }

  async recordEvent(
    provider: string,
    eventType: string,
    eventId: string,
    payload: Record<string, unknown>,
    accountId?: string
  ): Promise<ProviderEventDocument> {
    const now = new Date().toISOString();
    const doc = await this.db.createDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.providerEvents,
      ID.unique(),
      {
        accountId: accountId || '',
        provider,
        eventType,
        eventId,
        payload: JSON.stringify(payload),
        processed: true,
        createdAt: now,
      }
    );
    return doc as unknown as ProviderEventDocument;
  }
}

export const providerEventsRepository = new ProviderEventsRepository();
