import { ID, Query } from 'node-appwrite';
import { getAppwriteAdminClient } from '../server';
import { APPWRITE_CONFIG } from '../config';
import { createTenantPermissions } from '../permissions';

export interface ProfileDocument {
  $id: string;
  userId: string;
  accountId: string;
  name: string;
  email: string;
  role: 'owner' | 'admin' | 'agent' | 'viewer';
  avatarUrl?: string;
  is_super_admin?: boolean;
  createdAt: string;
  updatedAt: string;
}

export class ProfilesRepository {
  private get db() {
    return getAppwriteAdminClient().databases;
  }

  async getProfileByUserId(userId: string): Promise<ProfileDocument | null> {
    try {
      const res = await this.db.listDocuments(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.profiles,
        [Query.equal('userId', userId), Query.limit(1)]
      );
      if (res.documents.length === 0) return null;
      return res.documents[0] as unknown as ProfileDocument;
    } catch {
      return null;
    }
  }

  async listProfilesForAccount(accountId: string): Promise<ProfileDocument[]> {
    const res = await this.db.listDocuments(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.profiles,
      [Query.equal('accountId', accountId), Query.limit(100)]
    );
    return res.documents as unknown as ProfileDocument[];
  }

  async createProfile(
    data: Partial<ProfileDocument>
  ): Promise<ProfileDocument> {
    const permissions = data.accountId
      ? createTenantPermissions(data.accountId)
      : [];
    const now = new Date().toISOString();
    const doc = await this.db.createDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.profiles,
      data.$id || ID.unique(),
      {
        ...data,
        createdAt: now,
        updatedAt: now,
      },
      permissions
    );
    return doc as unknown as ProfileDocument;
  }

  async updateProfile(
    userId: string,
    data: Partial<ProfileDocument>
  ): Promise<ProfileDocument> {
    const existing = await this.getProfileByUserId(userId);
    if (!existing) throw new Error('Profile not found');

    const updated = await this.db.updateDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.profiles,
      existing.$id,
      {
        ...data,
        updatedAt: new Date().toISOString(),
      }
    );
    return updated as unknown as ProfileDocument;
  }
}

export const profilesRepository = new ProfilesRepository();
