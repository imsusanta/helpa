import { ID, Query } from 'node-appwrite';
import { getAppwriteAdminClient } from '../server';
import { APPWRITE_CONFIG } from '../config';
import { createTenantPermissions } from '../permissions';

export interface ContactDocument {
  $id: string;
  accountId: string;
  name: string;
  phone?: string;
  email?: string;
  tags?: string[];
  consentStatus?: 'pending' | 'opted_in' | 'opted_out';
  createdAt: string;
  updatedAt: string;
}

export class ContactsRepository {
  private get db() {
    return getAppwriteAdminClient().databases;
  }

  async listContacts(accountId: string): Promise<ContactDocument[]> {
    const res = await this.db.listDocuments(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.contacts,
      [Query.equal('accountId', accountId), Query.limit(100)]
    );
    return res.documents as unknown as ContactDocument[];
  }

  async getContact(
    accountId: string,
    contactId: string
  ): Promise<ContactDocument | null> {
    try {
      const doc = await this.db.getDocument(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.contacts,
        contactId
      );
      if ((doc as unknown as { accountId: string }).accountId !== accountId)
        return null;
      return doc as unknown as ContactDocument;
    } catch {
      return null;
    }
  }

  async getContactByE164(
    accountId: string,
    phone: string
  ): Promise<ContactDocument | null> {
    const res = await this.db.listDocuments(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.contacts,
      [Query.equal('accountId', accountId), Query.equal('phone', phone)]
    );
    if (res.documents.length > 1) {
      throw new Error('CONTACT_PHONE_NOT_UNIQUE');
    }
    return (res.documents[0] as unknown as ContactDocument | undefined) ?? null;
  }

  async createContact(
    accountId: string,
    data: Partial<ContactDocument>
  ): Promise<ContactDocument> {
    const permissions = createTenantPermissions(accountId);
    const now = new Date().toISOString();
    const doc = await this.db.createDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.contacts,
      ID.unique(),
      {
        ...data,
        accountId,
        createdAt: now,
        updatedAt: now,
      },
      permissions
    );
    return doc as unknown as ContactDocument;
  }

  async updateConsent(
    accountId: string,
    contactId: string,
    consentStatus: 'pending' | 'opted_in' | 'opted_out'
  ): Promise<ContactDocument> {
    const contact = await this.getContact(accountId, contactId);
    if (!contact) throw new Error('Contact not found');

    const updated = await this.db.updateDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.contacts,
      contactId,
      {
        consentStatus,
        updatedAt: new Date().toISOString(),
      }
    );

    return updated as unknown as ContactDocument;
  }
}

export const contactsRepository = new ContactsRepository();
