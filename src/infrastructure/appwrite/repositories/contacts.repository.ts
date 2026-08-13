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

export interface ContactListOptions {
  limit: number;
  offset: number;
  search?: string;
}

export interface PaginatedContacts {
  contacts: ContactDocument[];
  total: number;
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

  async listContactsPage(
    accountId: string,
    options: ContactListOptions
  ): Promise<PaginatedContacts> {
    const queries = [
      Query.equal('accountId', accountId),
      Query.orderDesc('$createdAt'),
      Query.limit(options.limit),
      Query.offset(options.offset),
    ];
    if (options.search) {
      // Appwrite search is an AND operation across query clauses. A canonical
      // name index is required; phone/email filtering remains a deliberate
      // future capability until dedicated normalized search attributes exist.
      queries.push(Query.search('name', options.search));
    }

    try {
      const res = await this.db.listDocuments(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.contacts,
        queries
      );
      return {
        contacts: res.documents as unknown as ContactDocument[],
        total: res.total,
      };
    } catch (err) {
      // If the error is due to a missing fulltext index on "name" and we
      // were searching, fall back to fetching all tenant contacts and
      // filtering in memory. This keeps the page working while the
      // fulltext index is being provisioned.
      const msg = err instanceof Error ? err.message : '';
      if (options.search && /index|attribute|search/i.test(msg)) {
        const fallbackQueries = [
          Query.equal('accountId', accountId),
          Query.orderDesc('$createdAt'),
          Query.limit(500),
        ];
        const res = await this.db.listDocuments(
          APPWRITE_CONFIG.databaseId,
          APPWRITE_CONFIG.collections.contacts,
          fallbackQueries
        );
        const needle = options.search.toLowerCase();
        const allDocs = res.documents as unknown as ContactDocument[];
        const filtered = allDocs.filter(
          (c) =>
            c.name?.toLowerCase().includes(needle) ||
            c.phone?.includes(needle) ||
            c.email?.toLowerCase().includes(needle)
        );
        const paged = filtered.slice(
          options.offset,
          options.offset + options.limit
        );
        return { contacts: paged, total: filtered.length };
      }
      throw err;
    }
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
