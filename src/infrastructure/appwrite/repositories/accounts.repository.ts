import { ID } from 'node-appwrite';
import { getAppwriteAdminClient } from '../server';
import { APPWRITE_CONFIG } from '../config';

export interface AccountDocument {
  $id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export class AccountsRepository {
  private get db() {
    return getAppwriteAdminClient().databases;
  }
  private get teams() {
    return getAppwriteAdminClient().teams;
  }

  async createTenantAccount(
    name: string
  ): Promise<{ accountDoc: AccountDocument; teamId: string }> {
    const now = new Date().toISOString();
    const accountDoc = await this.db.createDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.accounts,
      ID.unique(),
      {
        name,
        createdAt: now,
        updatedAt: now,
      }
    );

    const team = await this.teams.create(accountDoc.$id, name);

    return {
      accountDoc: accountDoc as unknown as AccountDocument,
      teamId: team.$id,
    };
  }

  async getAccount(accountId: string): Promise<AccountDocument | null> {
    try {
      const doc = await this.db.getDocument(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.accounts,
        accountId
      );
      return doc as unknown as AccountDocument;
    } catch {
      return null;
    }
  }
}

export const accountsRepository = new AccountsRepository();
