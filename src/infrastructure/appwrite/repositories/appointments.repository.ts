import { ID, Query } from 'node-appwrite';
import { getAppwriteAdminClient } from '../server';
import { APPWRITE_CONFIG } from '../config';
import { createTenantPermissions } from '../permissions';

export interface AppointmentDocument {
  $id: string;
  accountId: string;
  contactId?: string;
  title: string;
  startTime: string;
  endTime: string;
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show';
  source?: string;
  createdAt: string;
  updatedAt: string;
}

export class AppointmentsRepository {
  private get db() {
    return getAppwriteAdminClient().databases;
  }

  async listAppointments(accountId: string): Promise<AppointmentDocument[]> {
    const res = await this.db.listDocuments(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.appointments,
      [Query.equal('accountId', accountId), Query.limit(100)]
    );
    return res.documents as unknown as AppointmentDocument[];
  }

  async createAppointment(
    accountId: string,
    data: Partial<AppointmentDocument>
  ): Promise<AppointmentDocument> {
    const permissions = createTenantPermissions(accountId);
    const now = new Date().toISOString();
    const doc = await this.db.createDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.appointments,
      ID.unique(),
      {
        ...data,
        accountId,
        createdAt: now,
        updatedAt: now,
      },
      permissions
    );
    return doc as unknown as AppointmentDocument;
  }
}

export const appointmentsRepository = new AppointmentsRepository();
