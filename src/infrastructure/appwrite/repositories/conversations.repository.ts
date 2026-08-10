import { Query } from 'node-appwrite';
import { getAppwriteAdminClient } from '../server';
import { APPWRITE_CONFIG } from '../config';

export interface ConversationDocument {
  $id: string;
  accountId: string;
  contactId: string;
  channel: 'whatsapp' | 'sms' | 'voice';
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
}

export class ConversationsRepository {
  private get db() {
    return getAppwriteAdminClient().databases;
  }

  async listConversations(accountId: string): Promise<ConversationDocument[]> {
    const res = await this.db.listDocuments(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.conversations,
      [Query.equal('accountId', accountId), Query.limit(100)]
    );
    return res.documents as unknown as ConversationDocument[];
  }
}

export const conversationsRepository = new ConversationsRepository();
