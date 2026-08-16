/**
 * Helpa Health Module — Patient Service
 *
 * Handles patient creation, unique Patient ID generation (PT-XXXXXX),
 * multiple patients per mobile number, and patient timeline aggregation.
 */

import { getAdminClient } from '@/lib/appwrite-server-compat';

export interface PatientRecord {
  id: string;
  accountId: string;
  patientId: string; // e.g. PT-000123
  name: string;
  phone: string;
  gender?: string;
  dob?: string;
  age?: number;
  bloodGroup?: string;
  email?: string;
  address?: string;
  emergencyContact?: string;
  notes?: string;
  preferredDoctor?: string;
  insuranceProvider?: string;
  createdAt: string;
}

export interface PatientTimelineEvent {
  id: string;
  type:
    | 'conversation'
    | 'appointment'
    | 'prescription'
    | 'report'
    | 'followup'
    | 'checkin';
  title: string;
  description: string;
  timestamp: string;
  badge?: string;
}

/**
 * Generates the next sequential unique Patient ID (e.g. PT-000123) for a workspace.
 */
export async function generateNextPatientId(
  accountId: string
): Promise<string> {
  const db = getAdminClient();
  const { data: contacts } = await db
    .from('contacts')
    .select('extra_attributes')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false })
    .limit(50);

  let maxSeq = 0;
  if (contacts && contacts.length > 0) {
    for (const c of contacts) {
      const extra = (c.extra_attributes as Record<string, unknown>) || {};
      const ptId = String(extra.patient_id || extra.patient_seq_id || '');
      const match = ptId.match(/PT-(\d+)/i);
      if (match && match[1]) {
        const seq = parseInt(match[1], 10);
        if (!isNaN(seq) && seq > maxSeq) {
          maxSeq = seq;
        }
      }
    }
  }

  const nextSeq = maxSeq + 1;
  return `PT-${nextSeq.toString().padStart(6, '0')}`;
}

/**
 * Retrieves all patients registered under the same mobile number within a workspace.
 * Allows multiple family members (e.g. Rahul, Ananya, Rohan) on the same phone.
 */
export async function getPatientsByMobile(
  accountId: string,
  mobile: string
): Promise<PatientRecord[]> {
  const db = getAdminClient();
  const cleanPhone = mobile.replace(/[^\d+]/g, '');

  const { data: rows } = await db
    .from('contacts')
    .select('*')
    .eq('account_id', accountId)
    .or(`phone.eq.${cleanPhone},phone.eq.${cleanPhone.replace('+', '')}`);

  return (rows || []).map((r) => {
    const extra = (r.extra_attributes as Record<string, unknown>) || {};
    return {
      id: r.id,
      accountId: r.account_id,
      patientId: String(extra.patient_id || `PT-${r.id.slice(0, 6)}`),
      name: r.name,
      phone: r.phone,
      gender: extra.gender as string,
      dob: extra.dob as string,
      age: extra.age as number,
      bloodGroup: extra.blood_group as string,
      email: r.email,
      address: extra.address as string,
      emergencyContact: extra.emergency_contact as string,
      notes: r.notes,
      preferredDoctor: extra.preferred_doctor as string,
      insuranceProvider: extra.insurance_provider as string,
      createdAt: r.created_at,
    };
  });
}

/**
 * Creates or retrieves a patient record.
 * Generates an automatic Patient ID (PT-XXXXXX) if not supplied.
 */
export async function createOrFindPatient({
  accountId,
  name,
  phone,
  gender,
  dob,
  bloodGroup,
  notes,
}: {
  accountId: string;
  name: string;
  phone: string;
  gender?: string;
  dob?: string;
  bloodGroup?: string;
  notes?: string;
}): Promise<PatientRecord> {
  const db = getAdminClient();
  const cleanPhone = phone.replace(/[^\d+]/g, '');

  // 1. Check if patient with exact name and phone already exists
  const existingPatients = await getPatientsByMobile(accountId, cleanPhone);
  const exactMatch = existingPatients.find(
    (p) => p.name.trim().toLowerCase() === name.trim().toLowerCase()
  );

  if (exactMatch) {
    return exactMatch;
  }

  // 2. Otherwise create a new patient with unique Patient ID
  const patientId = await generateNextPatientId(accountId);
  const extraAttributes = {
    patient_id: patientId,
    gender,
    dob,
    blood_group: bloodGroup,
    created_via: 'health_patient_service',
  };

  const { data: created, error } = await db
    .from('contacts')
    .insert({
      account_id: accountId,
      name: name.trim(),
      phone: cleanPhone,
      notes,
      extra_attributes: extraAttributes,
      created_at: new Date().toISOString(),
    })
    .select('*')
    .single();

  if (error || !created) {
    throw new Error(
      `Failed to create patient: ${error?.message || 'DB error'}`
    );
  }

  return {
    id: created.id,
    accountId: created.account_id,
    patientId,
    name: created.name,
    phone: created.phone,
    gender,
    dob,
    bloodGroup,
    notes,
    createdAt: created.created_at,
  };
}

/**
 * Aggregates a full chronological patient timeline (Conversations, Appointments, Prescriptions, Reports).
 */
export async function getPatientTimeline(
  accountId: string,
  patientContactId: string
): Promise<PatientTimelineEvent[]> {
  const db = getAdminClient();
  const timeline: PatientTimelineEvent[] = [];

  // 1. Fetch appointments
  const { data: appts } = await db
    .from('appointments')
    .select('*')
    .eq('account_id', accountId)
    .eq('contact_id', patientContactId)
    .order('appointment_date', { ascending: false });

  (appts || []).forEach((a) => {
    timeline.push({
      id: `appt-${a.id}`,
      type: 'appointment',
      title: `Appointment ${a.status || 'Scheduled'}`,
      description: `Date: ${a.appointment_date} at ${a.appointment_time || 'TBD'}. ${a.notes || ''}`,
      timestamp: a.created_at || a.appointment_date,
      badge: a.status || 'Scheduled',
    });
  });

  // 2. Fetch lab reports if any
  const { data: reports } = await db
    .from('lab_reports')
    .select('*')
    .eq('account_id', accountId)
    .eq('patient_id', patientContactId);

  (reports || []).forEach((r) => {
    timeline.push({
      id: `report-${r.id}`,
      type: 'report',
      title: `Medical Report: ${r.test_name || 'Diagnostic Report'}`,
      description: `Status: ${r.status || 'Ready'}. Uploaded: ${r.created_at}`,
      timestamp: r.created_at,
      badge: r.status || 'Ready',
    });
  });

  // Sort timeline descending by timestamp
  return timeline.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}
