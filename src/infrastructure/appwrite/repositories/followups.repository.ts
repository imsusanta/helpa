import { Query } from 'node-appwrite';
import { getAppwriteAdminClient } from '../server';
import { APPWRITE_CONFIG } from '../config';

export interface FollowupDocument {
  $id: string;
  accountId: string;
  contactId: string;
  channel: 'whatsapp' | 'sms' | 'voice';
  scheduledAt: string;
  status: 'pending' | 'sent' | 'failed';
  createdAt: string;
}

export class FollowupsRepository {
  private get db() {
    return getAppwriteAdminClient().databases;
  }

  async listFollowups(accountId: string): Promise<FollowupDocument[]> {
    const res = await this.db.listDocuments(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.followups,
      [Query.equal('accountId', accountId), Query.limit(100)]
    );
    return res.documents as unknown as FollowupDocument[];
  }
}

export const followupsRepository = new FollowupsRepository();
