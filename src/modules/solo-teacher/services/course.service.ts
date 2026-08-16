/**
 * Helpa Solo Tutor Module — Course Service
 *
 * Course and subject management for independent teachers.
 */

import { getAdminClient } from '@/lib/appwrite-server-compat';

export interface TutorCourseRecord {
  id: string;
  accountId: string;
  name: string;
  code: string;
  subject: string; // e.g. "Mathematics", "Physics", "English"
  level: string; // e.g. "Class 10", "Class 9", "SSC"
  description?: string;
  durationMonths: number;
  mode: 'Online' | 'Offline' | 'Hybrid';
  feePerMonth?: number;
  status: 'Draft' | 'Active' | 'Paused' | 'Completed';
}

export async function listTutorCourses(
  accountId: string,
  subject?: string
): Promise<TutorCourseRecord[]> {
  const db = getAdminClient();
  let query = db.from('courses').select('*').eq('account_id', accountId);

  if (subject) {
    query = query.ilike('category', `%${subject}%`);
  }

  const { data: rows } = await query;
  if (!rows || rows.length === 0) {
    // Return sample courses for solo tutor workspace
    return [
      {
        id: 'tutor-crs-math10',
        accountId,
        name: 'Class 10 Mathematics',
        code: 'MATH-10',
        subject: 'Mathematics',
        level: 'Class 10 (CBSE & State Board)',
        description:
          'Complete syllabus coverage, NCERT solutions, and weekly practice tests.',
        durationMonths: 6,
        mode: 'Online',
        feePerMonth: 1500,
        status: 'Active',
      },
      {
        id: 'tutor-crs-ssc-math',
        accountId,
        name: 'SSC Quantitative Aptitude Mastery',
        code: 'SSC-MATH',
        subject: 'Mathematics',
        level: 'Competitive Exam (SSC / CGL / CHSL)',
        description:
          'Shortcuts, speed techniques, and previous year questions practice.',
        durationMonths: 4,
        mode: 'Online',
        feePerMonth: 2000,
        status: 'Active',
      },
    ];
  }

  return rows.map((r) => ({
    id: r.id,
    accountId: r.account_id,
    name: r.name,
    code: r.code || `CRS-${r.id.slice(0, 4)}`,
    subject: r.category || 'Mathematics',
    level: r.description || 'General Level',
    description: r.description,
    durationMonths: r.duration_months || 6,
    mode: r.mode || 'Online',
    feePerMonth: r.fee || 1500,
    status: r.status || 'Active',
  }));
}
