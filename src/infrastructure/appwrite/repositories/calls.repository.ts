import { Query } from 'node-appwrite';
import { getAppwriteAdminClient } from '../server';
import { APPWRITE_CONFIG } from '../config';

export interface CallDocument {
  $id: string;
  accountId: string;
  contactId?: string;
  provider: string;
  callSid: string;
  durationSeconds: number;
  recordingUrl?: string;
  createdAt: string;
}

export class CallsRepository {
  private get db() {
    return getAppwriteAdminClient().databases;
  }

  async listCalls(accountId: string): Promise<CallDocument[]> {
    const res = await this.db.listDocuments(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.calls,
      [Query.equal('accountId', accountId), Query.limit(100)]
    );
    return res.documents as unknown as CallDocument[];
  }
}

export const callsRepository = new CallsRepository();
