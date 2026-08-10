import { ID, Query } from 'node-appwrite';
import { getAppwriteAdminClient } from '../server';
import { APPWRITE_CONFIG } from '../config';
import { createTenantPermissions } from '../permissions';

export interface PatientDocument {
  $id: string;
  accountId: string;
  name: string;
  phone?: string;
  email?: string;
  gender?: string;
  dateOfBirth?: string;
  department?: string;
  assignedDoctorId?: string;
  consentStatus?: 'pending' | 'opted_in' | 'opted_out';
  createdAt: string;
  updatedAt: string;
}

export class PatientsRepository {
  private get db() {
    return getAppwriteAdminClient().databases;
  }

  async listPatients(accountId: string): Promise<PatientDocument[]> {
    const res = await this.db.listDocuments(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.patients,
      [Query.equal('accountId', accountId), Query.limit(100)]
    );
    return res.documents as unknown as PatientDocument[];
  }

  async getPatient(
    accountId: string,
    patientId: string
  ): Promise<PatientDocument | null> {
    try {
      const doc = await this.db.getDocument(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.patients,
        patientId
      );
      if ((doc as any).accountId !== accountId) return null;
      return doc as unknown as PatientDocument;
    } catch {
      return null;
    }
  }

  async createPatient(
    accountId: string,
    data: Partial<PatientDocument>
  ): Promise<PatientDocument> {
    const permissions = createTenantPermissions(accountId);
    const now = new Date().toISOString();
    const doc = await this.db.createDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.patients,
      ID.unique(),
      {
        ...data,
        accountId,
        createdAt: now,
        updatedAt: now,
      },
      permissions
    );
    return doc as unknown as PatientDocument;
  }

  async updatePatient(
    accountId: string,
    patientId: string,
    data: Partial<PatientDocument>
  ): Promise<PatientDocument> {
    const patient = await this.getPatient(accountId, patientId);
    if (!patient) throw new Error('Patient not found in tenant');

    const updated = await this.db.updateDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.patients,
      patientId,
      {
        ...data,
        updatedAt: new Date().toISOString(),
      }
    );
    return updated as unknown as PatientDocument;
  }

  async deletePatient(accountId: string, patientId: string): Promise<boolean> {
    const patient = await this.getPatient(accountId, patientId);
    if (!patient) throw new Error('Patient not found in tenant');

    await this.db.deleteDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.patients,
      patientId
    );
    return true;
  }
}

export const patientsRepository = new PatientsRepository();
