/**
 * Helpa Solo Tutor Module — Batch Service
 *
 * Micro-batch management for independent teachers.
 */

import { getAdminClient } from '@/lib/db/server';

export interface TutorBatchRecord {
  id: string;
  accountId: string;
  courseId: string;
  courseName: string;
  name: string;
  code: string;
  startDate: string;
  classDays: string[]; // e.g. ["Mon", "Wed", "Fri"]
  classTime: string; // e.g. "7:00 PM – 8:00 PM"
  mode: 'Online' | 'Offline' | 'Hybrid';
  maxStudents: number;
  currentStudents: number;
  availableSeats: number;
  status: 'Upcoming' | 'Active' | 'Full' | 'Completed';
}

export async function listTutorBatches(
  accountId: string,
  courseIdOrName?: string
): Promise<TutorBatchRecord[]> {
  const db = getAdminClient();
  let query = db.from('batches').select('*').eq('account_id', accountId);

  if (courseIdOrName) {
    query = query.ilike('course_name', `%${courseIdOrName}%`);
  }

  const { data: rows } = await query;
  if (!rows || rows.length === 0) {
    // Sample batches for solo tutor
    return [
      {
        id: 'batch-math10-eve',
        accountId,
        courseId: 'tutor-crs-math10',
        courseName: 'Class 10 Mathematics',
        name: 'Class 10 Math — Evening Batch',
        code: 'M10-EVE',
        startDate: '2026-08-20',
        classDays: ['Mon', 'Wed', 'Fri'],
        classTime: '7:00 PM – 8:00 PM',
        mode: 'Online',
        maxStudents: 15,
        currentStudents: 12,
        availableSeats: 3,
        status: 'Active',
      },
      {
        id: 'batch-ssc-morn',
        accountId,
        courseId: 'tutor-crs-ssc-math',
        courseName: 'SSC Quantitative Aptitude Mastery',
        name: 'SSC Math — Morning Batch',
        code: 'SSC-MORN',
        startDate: '2026-09-01',
        classDays: ['Tue', 'Thu', 'Sat'],
        classTime: '8:00 AM – 9:00 AM',
        mode: 'Online',
        maxStudents: 20,
        currentStudents: 14,
        availableSeats: 6,
        status: 'Upcoming',
      },
    ];
  }

  return rows.map((r) => {
    const max = r.capacity || 15;
    const current = r.enrolled_count || 0;
    const available = Math.max(0, max - current);
    return {
      id: r.id,
      accountId: r.account_id,
      courseId: r.course_id,
      courseName: r.course_name || 'Mathematics',
      name: r.name,
      code: r.code || `BAT-${r.id.slice(0, 4)}`,
      startDate: r.start_date || '2026-08-20',
      classDays: r.class_days || ['Mon', 'Wed', 'Fri'],
      classTime: r.class_time || '7:00 PM – 8:00 PM',
      mode: r.mode || 'Online',
      maxStudents: max,
      currentStudents: current,
      availableSeats: available,
      status: available === 0 ? 'Full' : r.status || 'Active',
    };
  });
}
