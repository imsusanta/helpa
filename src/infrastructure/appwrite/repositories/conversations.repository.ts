import { ID, Query } from 'node-appwrite';
import { createTenantPermissions } from '../permissions';
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

  async getOrCreateWhatsAppConversation(
    accountId: string,
    contactId: string,
    lastMessageText: string
  ): Promise<ConversationDocument> {
    const existing = await this.db.listDocuments(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.conversations,
      [
        Query.equal('accountId', accountId),
        Query.equal('contactId', contactId),
        Query.equal('channel', 'whatsapp'),
      ]
    );
    if (existing.documents.length > 1) {
      throw new Error('CONVERSATION_NOT_UNIQUE');
    }
    if (existing.documents[0]) {
      return existing.documents[0] as unknown as ConversationDocument;
    }

    const now = new Date().toISOString();
    const created = await this.db.createDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.conversations,
      ID.unique(),
      {
        accountId,
        contactId,
        channel: 'whatsapp',
        status: 'open',
        lastMessageText,
        lastMessageAt: now,
        createdAt: now,
        updatedAt: now,
      },
      createTenantPermissions(accountId)
    );
    return created as unknown as ConversationDocument;
  }
}

export const conversationsRepository = new ConversationsRepository();
