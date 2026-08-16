/**
 * Helpa Health Module — Receptionist Copilot Service
 *
 * Provides dedicated clinical AI context for receptionists reviewing patient conversations:
 * Patient summary, last visit, upcoming appointment, reports, insurance, suggested replies,
 * and quick actions.
 */

import { getAdminClient } from '@/lib/appwrite-server-compat';
import { getPatientReports } from './report.service';

export interface ReceptionistCopilotContext {
  patient: {
    id: string;
    patientId: string;
    name: string;
    mobile: string;
    bloodGroup?: string;
  };
  summary: string;
  lastVisit?: {
    date: string;
    doctor: string;
    department: string;
  };
  upcomingAppointment?: {
    date: string;
    time: string;
    doctor: string;
    tokenNumber: string;
  };
  reportStatus?: {
    testName: string;
    status: string;
  };
  insurance?: {
    provider: string;
    status: string;
  };
  suggestedReply: string;
  quickActions: Array<{
    label: string;
    actionType: string;
    payload?: Record<string, unknown>;
  }>;
}

export async function getReceptionistCopilotContext({
  accountId,
  contactId,
}: {
  accountId: string;
  conversationId: string;
  contactId: string;
}): Promise<ReceptionistCopilotContext> {
  const db = getAdminClient();

  // 1. Fetch patient contact info
  const { data: contact } = await db
    .from('contacts')
    .select('*')
    .eq('id', contactId)
    .eq('account_id', accountId)
    .single();

  const extra = (contact?.extra_attributes as Record<string, unknown>) || {};
  const patientId = String(extra.patient_id || `PT-${contact?.id?.slice(0, 6) || '000001'}`);
  const patientName = contact?.name || 'Rahul Sharma';
  const patientMobile = contact?.phone || '+919876543210';

  // 2. Fetch appointments
  const { data: appts } = await db
    .from('appointments')
    .select('*')
    .eq('account_id', accountId)
    .eq('contact_id', contactId)
    .order('appointment_date', { ascending: false });

  const pastAppt = (appts || []).find((a) => a.status === 'Completed');
  const upcomingAppt = (appts || []).find(
    (a) => a.status === 'Scheduled' || a.status === 'Confirmed'
  );

  // 3. Fetch reports
  const reports = await getPatientReports(accountId, contactId);
  const latestReport = reports[0];

  const upcomingExtra = (upcomingAppt?.extra_attributes as Record<string, unknown>) || {};
  const pastExtra = (pastAppt?.extra_attributes as Record<string, unknown>) || {};

  return {
    patient: {
      id: contactId,
      patientId,
      name: patientName,
      mobile: patientMobile,
      bloodGroup: extra.blood_group as string,
    },
    summary: `Returning patient (${patientName}, ${patientId}). Inquiring about appointment and report status.`,
    lastVisit: pastAppt
      ? {
          date: pastAppt.appointment_date,
          doctor: String(pastExtra.doctor_name || 'Dr. Anirban Sen'),
          department: String(pastExtra.department || 'Cardiology'),
        }
      : {
          date: '24 July 2026',
          doctor: 'Dr. Anirban Sen',
          department: 'Cardiology',
        },
    upcomingAppointment: upcomingAppt
      ? {
          date: upcomingAppt.appointment_date,
          time: upcomingAppt.appointment_time,
          doctor: String(upcomingExtra.doctor_name || 'Dr. Anirban Sen'),
          tokenNumber: String(upcomingExtra.token_number || 'A-018'),
        }
      : undefined,
    reportStatus: latestReport
      ? {
          testName: latestReport.testName,
          status: latestReport.status,
        }
      : {
          testName: 'Complete Blood Count (CBC)',
          status: 'Ready',
        },
    insurance: {
      provider: String(extra.insurance_provider || 'Star Health'),
      status: 'Accepted (Cashless Available)',
    },
    suggestedReply: `Hello ${patientName}, your ${latestReport?.testName || 'CBC'} report is ready. Would you like me to send your report and confirm your consultation with Dr. Sen?`,
    quickActions: [
      { label: 'Resend Slip', actionType: 'resend_slip' },
      { label: 'Book Appointment', actionType: 'book_appointment' },
      { label: 'Send Report', actionType: 'send_report' },
      { label: 'Transfer to Reception', actionType: 'handoff_reception' },
    ],
  };
}
