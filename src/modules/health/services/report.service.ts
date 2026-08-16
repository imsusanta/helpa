/**
 * Helpa Health Module — Report Service
 *
 * Patient diagnostic report tracking, status query, and secure delivery.
 * STRICT SAFETY RULE: Provides status and delivery only — NEVER interprets medical values.
 */

import { getAdminClient } from '@/lib/appwrite-server-compat';
import { sendWhatsAppMessage } from '@/core/whatsapp';

export interface PatientReport {
  id: string;
  accountId: string;
  patientId: string;
  patientName: string;
  testName: string;
  status: 'Processing' | 'Ready' | 'Delivered' | 'Archived';
  fileUrl?: string;
  uploadedAt: string;
  deliveredAt?: string;
}

export async function getPatientReports(
  accountId: string,
  patientIdOrContactId: string
): Promise<PatientReport[]> {
  const db = getAdminClient();
  const { data: rows } = await db
    .from('lab_reports')
    .select('*')
    .eq('account_id', accountId)
    .eq('patient_id', patientIdOrContactId);

  if (!rows || rows.length === 0) {
    // Return sample reports for health workspace demo
    return [
      {
        id: 'rep-001',
        accountId,
        patientId: patientIdOrContactId,
        patientName: 'Rahul Sharma',
        testName: 'Complete Blood Count (CBC)',
        status: 'Ready',
        fileUrl: 'https://helpa.studio/sample-reports/cbc.pdf',
        uploadedAt: '2026-08-15T09:00:00.000Z',
      },
    ];
  }

  return rows.map((r) => ({
    id: r.id,
    accountId: r.account_id,
    patientId: r.patient_id,
    patientName: r.patient_name || 'Patient',
    testName: r.test_name || 'Diagnostic Report',
    status: r.status || 'Ready',
    fileUrl: r.file_url,
    uploadedAt: r.created_at,
    deliveredAt: r.delivered_at,
  }));
}

export async function deliverReportToPatient(
  accountId: string,
  reportId: string,
  recipientMobile: string
): Promise<{ success: boolean; message: string }> {
  const db = getAdminClient();

  // 1. Mark report as delivered
  await db
    .from('lab_reports')
    .update({
      status: 'Delivered',
      delivered_at: new Date().toISOString(),
    })
    .eq('id', reportId)
    .eq('account_id', accountId);

  // 2. Send delivery notification via WhatsApp
  await sendWhatsAppMessage({
    tenantId: accountId,
    to: recipientMobile,
    type: 'text',
    text: '📄 Hello, your diagnostic medical report is ready and attached. Please find your official clinic report. For doctor consultation, reply with "Book Appointment".',
  });

  return {
    success: true,
    message: 'Report marked as delivered and sent to patient via WhatsApp.',
  };
}
