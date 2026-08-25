/**
 * Helpa Coaching Module — Student Service
 *
 * Student CRM, unique Student ID generation (STU-XXXXXX),
 * multiple students per mobile number (family members),
 * and distinction between leads/enquiries and enrolled students.
 */

import { getAdminClient } from '@/lib/db/server';

export interface StudentRecord {
  id: string;
  accountId: string;
  studentId: string; // e.g. STU-000123
  name: string;
  phone: string;
  email?: string;
  dob?: string;
  guardianName?: string;
  guardianPhone?: string;
  address?: string;
  targetExamOrCourse?: string;
  currentBatch?: string;
  status: 'lead' | 'enquiry' | 'admitted' | 'alumni' | 'inactive';
  feeStatus?: 'unpaid' | 'partial' | 'paid' | 'overdue';
  enquirySource?: string;
  notes?: string;
  createdAt: string;
}

/**
 * Generates the next sequential unique Student ID (e.g. STU-000123) for a coaching workspace.
 */
export async function generateNextStudentId(
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
      const stuId = String(extra.student_id || extra.student_seq_id || '');
      const match = stuId.match(/STU-(\d+)/i);
      if (match && match[1]) {
        const seq = parseInt(match[1], 10);
        if (!isNaN(seq) && seq > maxSeq) {
          maxSeq = seq;
        }
      }
    }
  }

  const nextSeq = maxSeq + 1;
  return `STU-${nextSeq.toString().padStart(6, '0')}`;
}

/**
 * Retrieves all students registered under the same mobile number within a workspace.
 * Allows a parent/guardian to have multiple children (e.g. Rahul & Ananya) on one WhatsApp number.
 */
export async function getStudentsByMobile(
  accountId: string,
  mobile: string
): Promise<StudentRecord[]> {
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
      studentId: String(extra.student_id || `STU-${r.id.slice(0, 6)}`),
      name: r.name,
      phone: r.phone,
      email: r.email,
      dob: extra.dob as string,
      guardianName: extra.guardian_name as string,
      guardianPhone: extra.guardian_phone as string,
      address: extra.address as string,
      targetExamOrCourse: extra.target_course as string,
      currentBatch: extra.current_batch as string,
      status: (extra.student_status as StudentRecord['status']) || 'lead',
      feeStatus: extra.fee_status as StudentRecord['feeStatus'],
      enquirySource: String(extra.enquiry_source || 'WhatsApp'),
      notes: r.notes,
      createdAt: r.created_at,
    };
  });
}

/**
 * Creates or retrieves a student/lead record.
 * Generates an automatic Student ID (STU-XXXXXX) if not supplied.
 */
export async function createOrFindStudent({
  accountId,
  name,
  phone,
  email,
  targetCourse,
  guardianName,
  status = 'lead',
  notes,
}: {
  accountId: string;
  name: string;
  phone: string;
  email?: string;
  targetCourse?: string;
  guardianName?: string;
  status?: StudentRecord['status'];
  notes?: string;
}): Promise<StudentRecord> {
  const db = getAdminClient();
  const cleanPhone = phone.replace(/[^\d+]/g, '');

  // 1. Check if student with exact name and phone already exists
  const existingStudents = await getStudentsByMobile(accountId, cleanPhone);
  const exactMatch = existingStudents.find(
    (s) => s.name.trim().toLowerCase() === name.trim().toLowerCase()
  );

  if (exactMatch) {
    return exactMatch;
  }

  // 2. Otherwise create a new student with unique Student ID
  const studentId = await generateNextStudentId(accountId);
  const extraAttributes = {
    student_id: studentId,
    target_course: targetCourse,
    guardian_name: guardianName,
    student_status: status,
    enquiry_source: 'WhatsApp',
    created_via: 'coaching_student_service',
  };

  const { data: created, error } = await db
    .from('contacts')
    .insert({
      account_id: accountId,
      name: name.trim(),
      phone: cleanPhone,
      email,
      notes,
      extra_attributes: extraAttributes,
      created_at: new Date().toISOString(),
    })
    .select('*')
    .single();

  if (error || !created) {
    throw new Error(
      `Failed to create student: ${error?.message || 'DB error'}`
    );
  }

  return {
    id: created.id,
    accountId: created.account_id,
    studentId,
    name: created.name,
    phone: created.phone,
    email: created.email,
    targetExamOrCourse: targetCourse,
    guardianName,
    status,
    notes,
    createdAt: created.created_at,
  };
}
