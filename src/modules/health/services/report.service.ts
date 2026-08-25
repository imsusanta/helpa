/**
 * Helpa Health Module — Report Service
 *
 * Patient diagnostic report tracking, status query, and secure delivery.
 * STRICT SAFETY RULE: Provides status and delivery only — NEVER interprets medical values.
 */

import { getAdminClient } from '@/lib/db/server';
import { sendWhatsAppMessage } from '@/core/whatsapp';
import { generateDocumentToken, verifyDocumentToken } from '@/lib/pdf-signing';
import { coreEvents } from '@/core/events';

export interface PatientReport {
  id: string;
  accountId: string;
  patientId: string;
  patientName: string;
  testName: string;
  status: 'Processing' | 'Ready' | 'Delivered' | 'Archived';
  expectedDeliveryDate?: string;
  fileUrl?: string;
  uploadedAt: string;
  deliveredAt?: string;
}

export interface ReportStatusResponse {
  state: 'Processing' | 'Ready' | 'Not Found' | 'Need Verification';
  patientName?: string;
  testName?: string;
  expectedDate?: string;
  secureDownloadUrl?: string;
  message: string;
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
    return [];
  }

  return rows.map((r) => ({
    id: r.id,
    accountId: r.account_id,
    patientId: r.patient_id,
    patientName: r.patient_name || 'Patient',
    testName: r.test_name || 'Diagnostic Report',
    status: r.status || 'Ready',
    expectedDeliveryDate: r.expected_delivery_date,
    fileUrl: r.file_url,
    uploadedAt: r.created_at,
    deliveredAt: r.delivered_at,
  }));
}

/**
 * Generates an authenticated, expiring signed URL for secure report downloads.
 */
export function generateReportSecureUrl(
  accountId: string,
  reportId: string,
  expiresInSeconds: number = 86400 * 7 // 7 days
): string {
  const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const token = generateDocumentToken({
    documentId: reportId,
    documentType: 'report',
    accountId,
    expiresAt,
  });

  return `/api/lab-reports/${reportId}/download?token=${token}`;
}

/**
 * Answers patient report status inquiries (e.g. "Amar report ready?", "Report status").
 * States: Processing | Ready | Not Found | Need Verification
 */
export async function checkReportStatusForPatient({
  accountId,
  contactId,
  phone,
  testNameQuery,
}: {
  accountId: string;
  contactId?: string;
  phone?: string;
  testNameQuery?: string;
}): Promise<ReportStatusResponse> {
  const db = getAdminClient();

  if (!contactId && !phone) {
    return {
      state: 'Need Verification',
      message:
        'Please provide your registered mobile number or Patient ID to check report status.',
    };
  }

  let resolvedContactId = contactId;
  let patientName = 'Patient';

  if (!resolvedContactId && phone) {
    const cleanPhone = phone.replace(/[^\d+]/g, '');
    const { data: contacts } = await db
      .from('contacts')
      .select('id, name')
      .eq('account_id', accountId)
      .or(`phone.eq.${cleanPhone},phone.eq.${cleanPhone.replace('+', '')}`)
      .limit(1);

    if (contacts && contacts.length > 0) {
      resolvedContactId = contacts[0].id;
      patientName = contacts[0].name || 'Patient';
    }
  }

  if (!resolvedContactId) {
    return {
      state: 'Not Found',
      message:
        'No registered patient record found for this number. Please check with clinic reception.',
    };
  }

  const { data: rows } = await db
    .from('lab_reports')
    .select('*')
    .eq('account_id', accountId)
    .eq('patient_id', resolvedContactId)
    .order('created_at', { ascending: false });

  if (!rows || rows.length === 0) {
    return {
      state: 'Not Found',
      message: `No lab reports found for ${patientName}. If your sample was collected today, please allow 12 to 24 hours for pathology processing.`,
    };
  }

  const target = testNameQuery
    ? rows.find((r) =>
        r.test_name?.toLowerCase().includes(testNameQuery.toLowerCase())
      ) || rows[0]
    : rows[0];

  const status = (target.status || '').toLowerCase();
  const testName = target.test_name || 'Diagnostic Report';
  const finalPatientName = target.patient_name || patientName;

  if (status === 'ready' || status === 'delivered') {
    const secureUrl = generateReportSecureUrl(accountId, target.id);
    return {
      state: 'Ready',
      patientName: finalPatientName,
      testName,
      secureDownloadUrl: secureUrl,
      message: `Your ${testName} report is READY. You can view/download your official report here: https://helpa.studio${secureUrl}`,
    };
  }

  if (
    status === 'processing' ||
    status === 'pending' ||
    status === 'in_progress'
  ) {
    const expected = target.expected_delivery_date || 'Today evening';
    return {
      state: 'Processing',
      patientName: finalPatientName,
      testName,
      expectedDate: expected,
      message: `Your ${testName} report is currently PROCESSING in our pathology lab. Expected delivery: ${expected}. We will send you a WhatsApp message as soon as it is ready.`,
    };
  }

  return {
    state: 'Not Found',
    message: 'Report status currently unavailable. Please contact reception.',
  };
}

export async function deliverReportToPatient(
  accountId: string,
  reportId: string,
  recipientMobile: string
): Promise<{ success: boolean; secureUrl: string; message: string }> {
  const db = getAdminClient();
  const secureUrl = generateReportSecureUrl(accountId, reportId);

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
    text: `📄 Hello, your diagnostic medical report is ready. View/download your official clinic report securely: https://helpa.studio${secureUrl}\n\nFor doctor consultation, reply with "Book Appointment".`,
  });

  // 3. Emit event
  coreEvents.emit('report.delivered', accountId, {
    reportId,
    recipientMobile,
    secureUrl,
    timestamp: new Date().toISOString(),
  });

  return {
    success: true,
    secureUrl,
    message: 'Report marked as delivered and sent to patient via WhatsApp.',
  };
}

export function verifyReportToken(
  token: string,
  reportId: string
): { valid: boolean; accountId?: string; error?: string } {
  return verifyDocumentToken(token, reportId, 'report');
}
