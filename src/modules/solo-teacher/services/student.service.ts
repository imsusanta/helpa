/**
 * Helpa Solo Tutor Module — Student Service
 *
 * Student management, unique Student ID generation (STU-XXXXXX),
 * multiple students per parent mobile number, and parent/guardian communication context.
 */

import { getAdminClient } from '@/lib/appwrite-server-compat';

export interface TutorStudentRecord {
  id: string;
  accountId: string;
  studentId: string; // e.g. STU-000123
  name: string;
  phone: string; // student's direct mobile or parent's mobile
  guardianName?: string;
  guardianPhone?: string;
  email?: string;
  subjectOrCourse?: string;
  levelOrClass?: string; // e.g. "Class 10", "SSC Math"
  currentBatch?: string;
  status: 'active' | 'enrolled' | 'inactive' | 'lead';
  notes?: string;
  createdAt: string;
}

/**
 * Generates the next sequential unique Student ID (e.g. STU-000123) for a tutor workspace.
 */
export async function generateNextTutorStudentId(
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
 * Retrieves all students linked to a mobile number (student or parent).
 * Supports parents managing multiple children (e.g. Ayan & Riya) on one WhatsApp number.
 */
export async function getTutorStudentsByMobile(
  accountId: string,
  mobile: string
): Promise<TutorStudentRecord[]> {
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
      guardianName: extra.guardian_name as string,
      guardianPhone: extra.guardian_phone as string,
      email: r.email,
      subjectOrCourse: extra.target_course as string,
      levelOrClass: extra.level_or_class as string,
      currentBatch: extra.current_batch as string,
      status:
        (extra.student_status as TutorStudentRecord['status']) || 'active',
      notes: r.notes,
      createdAt: r.created_at,
    };
  });
}

/**
 * Creates or retrieves a student in the tutor's workspace.
 */
export async function createOrFindTutorStudent({
  accountId,
  name,
  phone,
  guardianName,
  guardianPhone,
  subjectOrCourse,
  levelOrClass,
  status = 'active',
  notes,
}: {
  accountId: string;
  name: string;
  phone: string;
  guardianName?: string;
  guardianPhone?: string;
  subjectOrCourse?: string;
  levelOrClass?: string;
  status?: TutorStudentRecord['status'];
  notes?: string;
}): Promise<TutorStudentRecord> {
  const db = getAdminClient();
  const cleanPhone = phone.replace(/[^\d+]/g, '');

  // 1. Check if student with exact name and phone already exists
  const existing = await getTutorStudentsByMobile(accountId, cleanPhone);
  const exact = existing.find(
    (s) => s.name.trim().toLowerCase() === name.trim().toLowerCase()
  );

  if (exact) {
    return exact;
  }

  // 2. Create new student record with unique STU-XXXXXX ID
  const studentId = await generateNextTutorStudentId(accountId);
  const extraAttributes = {
    student_id: studentId,
    guardian_name: guardianName,
    guardian_phone: guardianPhone,
    target_course: subjectOrCourse,
    level_or_class: levelOrClass,
    student_status: status,
    created_via: 'tutor_student_service',
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
      `Failed to create tutor student: ${error?.message || 'DB error'}`
    );
  }

  return {
    id: created.id,
    accountId: created.account_id,
    studentId,
    name: created.name,
    phone: created.phone,
    guardianName,
    guardianPhone,
    subjectOrCourse,
    levelOrClass,
    status,
    notes,
    createdAt: created.created_at,
  };
}

/**
 * Disambiguates incoming parent/student context if multiple children share one mobile number.
 */
export async function resolveStudentOrAskParent(
  accountId: string,
  mobile: string,
  explicitStudentName?: string
): Promise<{
  isAmbiguous: boolean;
  studentsFound: TutorStudentRecord[];
  selectedStudent?: TutorStudentRecord;
  clarificationMessage?: string;
}> {
  const students = await getTutorStudentsByMobile(accountId, mobile);

  if (students.length === 0) {
    return { isAmbiguous: false, studentsFound: [] };
  }

  if (students.length === 1) {
    return {
      isAmbiguous: false,
      studentsFound: students,
      selectedStudent: students[0],
    };
  }

  // If student name was explicitly mentioned
  if (explicitStudentName) {
    const match = students.find((s) =>
      s.name.toLowerCase().includes(explicitStudentName.toLowerCase())
    );
    if (match) {
      return {
        isAmbiguous: false,
        studentsFound: students,
        selectedStudent: match,
      };
    }
  }

  // Ambiguous: multiple children found
  const names = students.map((s) => s.name).join(' or ');
  return {
    isAmbiguous: true,
    studentsFound: students,
    clarificationMessage: `Which student are you asking about — ${names}?`,
  };
}
