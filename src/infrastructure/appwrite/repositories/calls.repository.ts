import { Query } from 'node-appwrite';
import { getAppwriteAdminClient } from '../server';
import { APPWRITE_CONFIG } from '../config';

export interface CallDocument {
  $id: string;
  accountId: string;
  contactId?: string;
  patientPhone?: string;
  direction?: 'inbound' | 'outbound';
  status?: string;
  provider: string;
  callSid?: string;
  durationSeconds?: number;
  recordingUrl?: string;
  createdAt: string;
}

export class CallsRepository {
  private get db() {
    return getAppwriteAdminClient().databases;
  }

  async getCall(
    accountId: string,
    callId: string
  ): Promise<CallDocument | null> {
    try {
      const doc = await this.db.getDocument(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.calls,
        callId
      );
      if ((doc as unknown as { accountId: string }).accountId !== accountId)
        return null;
      return doc as unknown as CallDocument;
    } catch {
      return null;
    }
  }

  async listCalls(accountId: string): Promise<CallDocument[]> {
    const res = await this.db.listDocuments(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.calls,
      [Query.equal('accountId', accountId), Query.limit(100)]
    );
    return res.documents as unknown as CallDocument[];
  }

  async createCall(
    accountId: string,
    data: Omit<CallDocument, '$id' | 'accountId' | 'createdAt'>
  ): Promise<CallDocument> {
    const doc = await this.db.createDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.calls,
      'unique()',
      {
        accountId,
        ...data,
        createdAt: new Date().toISOString(),
      }
    );
    return doc as unknown as CallDocument;
  }

  async updateCallStatus(
    accountId: string,
    callId: string,
    status: string,
    extra?: Record<string, unknown>
  ): Promise<CallDocument> {
    const doc = await this.db.updateDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.calls,
      callId,
      { status, ...extra }
    );
    return doc as unknown as CallDocument;
  }
}

export const callsRepository = new CallsRepository();
