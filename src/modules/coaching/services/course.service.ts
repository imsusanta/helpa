/**
 * Helpa Coaching Module — Course Service
 *
 * Course catalog, fee structure, duration, and admission availability.
 */

import { getAdminClient } from '@/lib/appwrite-server-compat';

export interface CourseRecord {
  id: string;
  accountId: string;
  name: string;
  code: string;
  category: string; // e.g. 'Engineering', 'Medical', 'Civil Services', 'Language'
  description?: string;
  durationMonths: number; // e.g. 12
  mode: 'Offline' | 'Online' | 'Hybrid';
  totalFee: number; // e.g. 25000
  registrationFee: number; // e.g. 2000
  discountAvailable?: number;
  status: 'Active' | 'Draft' | 'Paused' | 'Archived';
  subjects?: string[];
}

export async function listCoachingCourses(
  accountId: string,
  category?: string
): Promise<CourseRecord[]> {
  const db = getAdminClient();
  let query = db.from('courses').select('*').eq('account_id', accountId);

  if (category) {
    query = query.ilike('category', `%${category}%`);
  }

  const { data: rows } = await query;
  if (!rows || rows.length === 0) {
    // Return standard active coaching catalog if not populated in DB
    return [
      {
        id: 'course-ssc-01',
        accountId,
        name: 'SSC CGL Foundation',
        code: 'SSC-CGL-101',
        category: 'Staff Selection Commission (SSC)',
        description:
          'Comprehensive 12-month preparation for SSC CGL Tier 1 & Tier 2 exams.',
        durationMonths: 12,
        mode: 'Hybrid',
        totalFee: 25000,
        registrationFee: 2000,
        status: 'Active',
        subjects: [
          'Quantitative Aptitude',
          'General Intelligence & Reasoning',
          'English Language',
          'General Awareness',
        ],
      },
      {
        id: 'course-neet-02',
        accountId,
        name: 'NEET Medical Foundation',
        code: 'NEET-MED-201',
        category: 'Medical Entrance (NEET)',
        description:
          'Intensive 2-year classroom and test-series program for NEET aspirants.',
        durationMonths: 24,
        mode: 'Offline',
        totalFee: 65000,
        registrationFee: 5000,
        status: 'Active',
        subjects: ['Physics', 'Chemistry', 'Biology (Botany & Zoology)'],
      },
    ];
  }

  return rows.map((r) => ({
    id: r.id,
    accountId: r.account_id,
    name: r.name,
    code: r.code || `CRS-${r.id.slice(0, 4)}`,
    category: r.category || 'Competitive Exams',
    description: r.description,
    durationMonths: r.duration_months || 6,
    mode: r.mode || 'Hybrid',
    totalFee: r.fee || r.total_fee || 15000,
    registrationFee: r.registration_fee || 1000,
    discountAvailable: r.discount,
    status: r.status || 'Active',
    subjects: r.subjects || [],
  }));
}

export async function findCourseByNameOrCode(
  accountId: string,
  searchQuery: string
): Promise<CourseRecord | undefined> {
  const courses = await listCoachingCourses(accountId);
  const q = searchQuery.toLowerCase().trim();

  return courses.find(
    (c) =>
      c.status === 'Active' &&
      (c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q))
  );
}
