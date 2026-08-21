/* eslint-disable @typescript-eslint/no-explicit-any */
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
        name: data.name || '',
        phone: data.phone || '',
        email: data.email || '',
        gender: data.gender || '',
        dateOfBirth: data.dateOfBirth || '',
        department: data.department || '',
        assignedDoctorId: data.assignedDoctorId || '',
        consentStatus: data.consentStatus || 'pending',
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

    // Explicit DTO Allowlist - prevents overwriting protected fields like accountId
    const safePayload: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };
    if (data.name !== undefined) safePayload.name = data.name;
    if (data.phone !== undefined) safePayload.phone = data.phone;
    if (data.email !== undefined) safePayload.email = data.email;
    if (data.gender !== undefined) safePayload.gender = data.gender;
    if (data.dateOfBirth !== undefined)
      safePayload.dateOfBirth = data.dateOfBirth;
    if (data.department !== undefined) safePayload.department = data.department;
    if (data.assignedDoctorId !== undefined)
      safePayload.assignedDoctorId = data.assignedDoctorId;
    if (data.consentStatus !== undefined)
      safePayload.consentStatus = data.consentStatus;

    const updated = await this.db.updateDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.patients,
      patientId,
      safePayload
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

    // Record audit log event for patient deletion
    const now = new Date().toISOString();
    await this.db
      .createDocument(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.auditLogs,
        ID.unique(),
        {
          accountId,
          actorId: 'system',
          action: 'patient.delete',
          resourceType: 'patient',
          resourceId: patientId,
          details: JSON.stringify({ name: patient.name }),
          createdAt: now,
        },
        createTenantPermissions(accountId)
      )
      .catch(() => {});

    return true;
  }
}

export const patientsRepository = new PatientsRepository();
