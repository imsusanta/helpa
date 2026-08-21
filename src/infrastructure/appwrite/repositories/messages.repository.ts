import { ID, Query } from 'node-appwrite';
import { getAppwriteAdminClient } from '../server';
import { APPWRITE_CONFIG } from '../config';
import { createTenantPermissions } from '../permissions';

export interface MessageDocument {
  $id: string;
  accountId: string;
  conversationId: string;
  senderType: 'contact' | 'agent' | 'system' | 'bot';
  senderId?: string;
  content: string;
  mediaUrl?: string;
  mediaType?: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  providerMessageId?: string;
  createdAt: string;
}

export class MessagesRepository {
  private get db() {
    return getAppwriteAdminClient().databases;
  }

  async listMessages(
    accountId: string,
    conversationId: string
  ): Promise<MessageDocument[]> {
    const res = await this.db.listDocuments(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.messages,
      [
        Query.equal('accountId', accountId),
        Query.equal('conversationId', conversationId),
        Query.orderAsc('createdAt'),
        Query.limit(100),
      ]
    );
    return res.documents as unknown as MessageDocument[];
  }

  async createMessage(
    accountId: string,
    data: Partial<MessageDocument>
  ): Promise<MessageDocument> {
    const permissions = createTenantPermissions(accountId);
    const now = new Date().toISOString();
    const doc = await this.db.createDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.messages,
      ID.unique(),
      {
        ...data,
        accountId,
        createdAt: now,
      },
      permissions
    );
    return doc as unknown as MessageDocument;
  }
}

export const messagesRepository = new MessagesRepository();
