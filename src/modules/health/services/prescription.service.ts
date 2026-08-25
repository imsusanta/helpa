/**
 * Helpa Health Module — Prescription Service
 *
 * Handles clinical prescription creation, secure cryptographic link signing,
 * expiring access tokens, and automated WhatsApp delivery.
 */

import { getAdminClient } from '@/lib/db/server';
import { sendWhatsAppMessage } from '@/core/whatsapp';
import { generateDocumentToken, verifyDocumentToken } from '@/lib/pdf-signing';
import { coreEvents } from '@/core/events';

export interface HealthPrescription {
  id: string;
  accountId: string;
  patientId: string;
  patientName: string;
  patientMobile: string;
  doctorName: string;
  department: string;
  diagnosis?: string;
  medicines: Array<{
    name: string;
    dosage: string;
    duration: string;
    instructions?: string;
  }>;
  notes?: string;
  fileUrl?: string;
  status: 'Draft' | 'Ready' | 'Delivered';
  createdAt: string;
}

/**
 * Creates a prescription record for a patient.
 */
export async function createHealthPrescription({
  accountId,
  patientId,
  patientName,
  patientMobile,
  doctorName,
  department,
  diagnosis,
  medicines,
  notes,
  fileUrl,
}: {
  accountId: string;
  patientId: string;
  patientName: string;
  patientMobile: string;
  doctorName: string;
  department?: string;
  diagnosis?: string;
  medicines?: Array<{
    name: string;
    dosage: string;
    duration: string;
    instructions?: string;
  }>;
  notes?: string;
  fileUrl?: string;
}): Promise<HealthPrescription> {
  const db = getAdminClient();

  const extraAttributes = {
    patient_id: patientId,
    patient_name: patientName,
    patient_mobile: patientMobile,
    doctor_name: doctorName,
    department: department || 'General Medicine',
    diagnosis,
    medicines: medicines || [],
    notes,
    file_url: fileUrl,
  };

  const { data: created, error } = await db
    .from('prescriptions')
    .insert({
      account_id: accountId,
      patient_id: patientId,
      doctor_name: doctorName,
      status: 'Ready',
      extra_attributes: extraAttributes,
      created_at: new Date().toISOString(),
    })
    .select('*')
    .single();

  if (error || !created) {
    throw new Error(
      `Failed to create prescription: ${error?.message || 'Database error'}`
    );
  }

  return {
    id: created.id,
    accountId: created.account_id,
    patientId,
    patientName,
    patientMobile,
    doctorName,
    department: department || 'General Medicine',
    diagnosis,
    medicines: medicines || [],
    notes,
    fileUrl,
    status: 'Ready',
    createdAt: created.created_at,
  };
}

/**
 * Generates a cryptographically signed expiring link for public/patient viewing.
 */
export function generatePrescriptionSecureUrl(
  accountId: string,
  prescriptionId: string,
  expiresInSeconds: number = 86400 * 7 // 7 days
): string {
  const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const token = generateDocumentToken({
    documentId: prescriptionId,
    documentType: 'prescription',
    accountId,
    expiresAt,
  });

  return `/api/prescriptions/${prescriptionId}/view?token=${token}`;
}

/**
 * Delivers prescription to patient via WhatsApp with an authenticated expiring signed link.
 */
export async function deliverPrescriptionToPatient({
  accountId,
  prescriptionId,
  recipientMobile,
  patientName,
  doctorName,
}: {
  accountId: string;
  prescriptionId: string;
  recipientMobile: string;
  patientName: string;
  doctorName: string;
}): Promise<{ success: boolean; secureUrl: string; message: string }> {
  const db = getAdminClient();
  const secureUrl = generatePrescriptionSecureUrl(accountId, prescriptionId);

  // 1. Update prescription status
  await db
    .from('prescriptions')
    .update({
      status: 'Delivered',
      updated_at: new Date().toISOString(),
    })
    .eq('id', prescriptionId)
    .eq('account_id', accountId);

  // 2. Send WhatsApp Notification
  const text = `💊 Hello ${patientName}, your official digital prescription from ${doctorName} is ready. View your secure prescription here: https://helpa.studio${secureUrl}\n\nFor any follow-up questions or medicines enquiry, simply reply to this message.`;

  await sendWhatsAppMessage({
    tenantId: accountId,
    to: recipientMobile,
    type: 'text',
    text,
  });

  // 3. Emit event
  coreEvents.emit('prescription.delivered', accountId, {
    prescriptionId,
    patientName,
    recipientMobile,
    doctorName,
    timestamp: new Date().toISOString(),
  });

  return {
    success: true,
    secureUrl,
    message: `Prescription delivered to ${patientName} via WhatsApp.`,
  };
}

/**
 * Validates document token and checks resource access.
 */
export function verifyPrescriptionToken(
  token: string,
  prescriptionId: string
): { valid: boolean; accountId?: string; error?: string } {
  return verifyDocumentToken(token, prescriptionId, 'prescription');
}
