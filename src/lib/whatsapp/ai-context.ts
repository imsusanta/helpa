/**
 * Industry-specific context assembly for the AI receptionist.
 *
 * Given the resolved contact/patient id set, this module loads the
 * hospital roster (doctors, branches, appointments, lab reports,
 * registered patients, last campaign) or the coaching student list,
 * and renders them into the plain-text context blocks the system
 * prompt consumes. Pure formatting helpers are exported separately so
 * they can be unit-tested without a database.
 */
import type { AdminClient } from '@/lib/db/server';

export interface LabReportRow {
  id: string;
  test_name: string;
  status: string;
  report_pdf_url?: string | null;
  department?: string | null;
  expected_delivery_date?: string | null;
  notes?: string | null;
  internal_notes?: string | null;
}

export interface HospitalDoctorContextRow {
  name: string;
  department?: string;
  specialization?: string;
  consultation_fee?: number;
  fee?: number;
  available_days?: string[];
  working_hours?: unknown;
}

export interface CoachingCourseContextRow {
  name: string;
  fee?: number;
  duration?: string | null;
}

export interface IndustryAiContext {
  hospitalContext: string;
  coachingContext: string;
  labReports: LabReportRow[] | null;
  hospitalDoctors: HospitalDoctorContextRow[];
  coachingCourses: CoachingCourseContextRow[];
  hospitalLookupFailed: boolean;
  coachingLookupFailed: boolean;
}

type MaybeArray<T> = T | T[] | null | undefined;

/** PostgREST renders to-one joins as object or single-element array. */
function joinedName(value: MaybeArray<{ name?: string }>): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0]?.name : value.name;
}

export function formatCoachingStudents(
  students: Array<{ metadata?: Record<string, string> | null; name: string }>,
  entityLabel: string
): string {
  if (students.length === 0) return '';
  let out = `Registered ${entityLabel}s under this WhatsApp/Phone Number:\n`;
  for (const s of students) {
    const meta =
      s.metadata && typeof s.metadata === 'object'
        ? (s.metadata as Record<string, string>)
        : {};
    out += `- Name: ${s.name}, Student ID: ${meta.student_id || 'N/A'}, Exam Preparation (Target Exam): ${meta.parent_name || 'Not set'}\n`;
  }
  return out + '\n';
}

export function formatCoachingCourses(
  courses: Array<{
    name: string;
    fee?: number | string | null;
    duration?: string | null;
  }>
): string {
  if (courses.length === 0) return '';
  let out = 'Available Courses:\n';
  for (const course of courses) {
    const fee = Number(course.fee);
    const feeText =
      Number.isFinite(fee) && fee > 0
        ? `Fee: ₹${fee.toLocaleString('en-IN')}`
        : 'Fee: not listed';
    out += `- ${course.name}: ${feeText}${
      course.duration ? `, Duration: ${course.duration}` : ''
    }\n`;
  }
  return out + '\n';
}

export function formatRegisteredPatients(
  patients: Array<{
    contact?: MaybeArray<{ name?: string; phone?: string }>;
    patient_seq_id: string;
    gender?: string;
    date_of_birth?: string;
    blood_group?: string;
    emergency_contact?: string;
  }>
): string {
  if (patients.length === 0) return '';
  let out = 'Registered Patients under this WhatsApp/Phone Number:\n';
  for (const p of patients) {
    const contactData = p.contact;
    const name =
      joinedName(contactData as MaybeArray<{ name?: string }>) || 'Unknown';
    const phone =
      (Array.isArray(contactData)
        ? contactData[0]?.phone
        : contactData?.phone) || 'N/A';
    out += `- Name: ${name}, Patient ID: ${p.patient_seq_id}, Gender: ${p.gender || 'N/A'}, DOB: ${p.date_of_birth || 'N/A'}, Blood Group: ${p.blood_group || 'N/A'}, Phone: ${phone}, Emergency Contact: ${p.emergency_contact || 'N/A'}\n`;
  }
  return out + '\n';
}

export function formatDoctors(
  doctors: Array<{
    available_days?: string[];
    working_hours?: unknown;
    name: string;
    department: string;
    specialization?: string;
    consultation_fee?: number;
  }>
): string {
  if (doctors.length === 0) return '';
  let out = 'Available Doctors & Clinic Schedules:\n';
  for (const d of doctors) {
    const days = Array.isArray(d.available_days)
      ? d.available_days.join(', ')
      : '';
    const workingHours = d.working_hours as
      { start?: string; end?: string } | null | undefined;
    const start = workingHours?.start || '09:00';
    const end = workingHours?.end || '17:00';
    out += `- Dr. ${d.name.replace(/^Dr\.\s+/i, '')} (${d.department} - ${d.specialization || 'General'}): Fee: ₹${d.consultation_fee || '0'}, Working Days: ${days}, Working Hours: ${start} to ${end}\n`;
  }
  return out;
}

export function formatBranches(
  branches: Array<{ name: string; address?: string; phone?: string }>
): string {
  if (branches.length === 0) return '';
  let out = '\nClinic Branches Locations:\n';
  for (const b of branches) {
    out += `- ${b.name}: ${b.address || ''} (Phone: ${b.phone || ''})\n`;
  }
  return out;
}

export function formatAppointments(
  appts: Array<Record<string, unknown>>
): string {
  if (appts.length === 0) return '';
  let out = "\nPatient's Recent/Upcoming Appointments:\n";
  for (const a of appts) {
    const pName =
      joinedName(a.patient as MaybeArray<{ name?: string }>) || 'Unknown';
    const docName =
      joinedName(a.doctor as MaybeArray<{ name?: string }>) || 'Unassigned';
    out += `- Patient: ${pName}, Date: ${a.appointment_date}, Time: ${a.appointment_time}, Doctor: ${docName}, Status: ${a.status}, Token: #${a.token_number || 'N/A'}, Queue Pos: ${a.queue_position || 'N/A'}\n`;
  }
  return out;
}

export function formatLabReports(reports: LabReportRow[]): string {
  if (reports.length === 0) return '';
  let out = "\nPatient's Lab/Diagnostic Reports:\n";
  for (const rItem of reports) {
    const r = rItem as unknown as Record<string, unknown>;
    const docName =
      joinedName(r.doctor as MaybeArray<{ name?: string }>) || 'Doctor';
    const pName =
      joinedName(r.patient as MaybeArray<{ name?: string }>) || 'Unknown';
    out += `- Patient: ${pName}, Report Name: ${r.test_name}, Department: ${r.department || 'General'}, Referred By: Dr. ${docName.replace(/^Dr\.\s+/i, '')}, Status: ${r.status}, Expected Delivery: ${r.expected_delivery_date || 'N/A'}, Notes: ${r.notes || 'None'}, PDF Available: ${r.report_pdf_url ? 'Yes' : 'No'}\n`;
  }
  return out;
}

export function formatLastCampaign(campaign: {
  id: string;
  name: string;
  category?: string;
  message_body?: string;
  cta_type?: string;
}): string {
  let out = `Last Sent Campaign to Patient (within last 7 days):\n`;
  out += `- Campaign ID: ${campaign.id}\n`;
  out += `- Name: ${campaign.name}\n`;
  out += `- Category: ${campaign.category || 'General Announcement'}\n`;
  out += `- Message Content: "${campaign.message_body || ''}"\n`;
  out += `- CTA Configured: ${campaign.cta_type || 'none'}\n\n`;
  return out;
}

export interface BuildIndustryContextArgs {
  accountId: string;
  contactId: string;
  /** Contact ids sharing the WhatsApp phone number. */
  contactIds: string[];
  /** Contact ids plus registered patient ids. */
  allPatientAndContactIds: string[];
  isHospitalEnabled: boolean;
  isCoachingEnabled: boolean;
  isSoloTeacherEnabled: boolean;
  /** Industry-module label for the contact entity, e.g. "Student". */
  entityLabel: string;
}

export async function buildIndustryAiContext(
  db: AdminClient,
  args: BuildIndustryContextArgs
): Promise<IndustryAiContext> {
  let hospitalContext = '';
  let coachingContext = '';
  let labReports: LabReportRow[] | null = null;
  let hospitalDoctors: HospitalDoctorContextRow[] = [];
  let coachingCourses: CoachingCourseContextRow[] = [];
  let hospitalLookupFailed = false;
  let coachingLookupFailed = false;

  if (args.isCoachingEnabled || args.isSoloTeacherEnabled) {
    const [studentsRes, coursesRes] = await Promise.all([
      db
        .from('contacts')
        .select('name, phone, metadata')
        .in('id', args.contactIds),
      db
        .from('coaching_courses')
        .select('name, fee, duration')
        .eq('account_id', args.accountId),
    ]);
    coachingLookupFailed = Boolean(coursesRes.error);
    coachingCourses = ((coursesRes.data || []) as CoachingCourseContextRow[]).filter(
      (course) => Boolean(course?.name)
    );
    coachingContext =
      formatCoachingStudents(
        (studentsRes.data || []) as Array<{
          metadata?: Record<string, string> | null;
          name: string;
        }>,
        args.entityLabel
      ) + formatCoachingCourses(coachingCourses);
  }

  if (args.isHospitalEnabled) {
    const [
      doctorsRes,
      { data: branches },
      { data: appts },
      { data: labReportsData },
      { data: registeredPatients },
      { data: lastCampaignRec },
    ] = await Promise.all([
      db
        .from('hospital_doctors')
        .select(
          'name, department, specialization, consultation_fee, available_days, working_hours'
        )
        .eq('account_id', args.accountId)
        .eq('status', 'active'),
      db
        .from('hospital_branches')
        .select('name, address, phone')
        .eq('account_id', args.accountId),
      db
        .from('appointments')
        .select('*, doctor:hospital_doctors(name), patient:contacts(name)')
        .in('patient_id', args.allPatientAndContactIds)
        .order('appointment_date', { ascending: false })
        .limit(5),
      db
        .from('hospital_lab_reports')
        .select(
          'id, test_name, status, expected_delivery_date, report_pdf_url, notes, department, doctor:hospital_doctors(name), patient:contacts(name)'
        )
        .in('patient_id', args.allPatientAndContactIds)
        .order('created_at', { ascending: false })
        .limit(20),
      db
        .from('patients')
        .select(
          'patient_seq_id, gender, date_of_birth, blood_group, emergency_contact, contact:contacts(name, phone)'
        )
        .in('id', args.allPatientAndContactIds),
      db
        .from('broadcast_recipients')
        .select('id, broadcast_id, broadcasts(*)')
        .eq('contact_id', args.contactId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    labReports = labReportsData as LabReportRow[] | null;
    hospitalLookupFailed = Boolean(doctorsRes.error);
    hospitalDoctors = ((doctorsRes.data || []) as HospitalDoctorContextRow[]).filter(
      (doctor) => Boolean(doctor?.name)
    );

    hospitalContext += formatRegisteredPatients(
      (registeredPatients || []) as Parameters<
        typeof formatRegisteredPatients
      >[0]
    );

    if (lastCampaignRec && lastCampaignRec.broadcasts) {
      hospitalContext += formatLastCampaign(
        lastCampaignRec.broadcasts as unknown as {
          id: string;
          name: string;
          category?: string;
          message_body?: string;
          cta_type?: string;
        }
      );
    }

    hospitalContext += formatDoctors(
      hospitalDoctors as Parameters<typeof formatDoctors>[0]
    );
    hospitalContext += formatBranches(
      (branches || []) as Parameters<typeof formatBranches>[0]
    );
    hospitalContext += formatAppointments(
      (appts || []) as Array<Record<string, unknown>>
    );
    hospitalContext += formatLabReports(labReports || []);
  }

  return {
    hospitalContext,
    coachingContext,
    labReports,
    hospitalDoctors,
    coachingCourses,
    hospitalLookupFailed,
    coachingLookupFailed,
  };
}
