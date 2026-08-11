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

  async getConversation(
    accountId: string,
    conversationId: string
  ): Promise<ConversationDocument | null> {
    try {
      const doc = await this.db.getDocument(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.conversations,
        conversationId
      );
      if ((doc as unknown as { accountId: string }).accountId !== accountId)
        return null;
      return doc as unknown as ConversationDocument;
    } catch {
      return null;
    }
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
