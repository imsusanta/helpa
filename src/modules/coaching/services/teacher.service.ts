/**
 * Helpa Coaching Module — Teacher Service
 *
 * Faculty directory, subject specializations, and course assignments.
 */

import { getAdminClient } from '@/lib/db/server';

export interface TeacherRecord {
  id: string;
  accountId: string;
  name: string;
  specialization: string;
  subjects: string[];
  experienceYears: number;
  assignedCourses: string[];
  bio?: string;
  isActive: boolean;
}

export async function listCoachingTeachers(
  accountId: string,
  subject?: string
): Promise<TeacherRecord[]> {
  const db = getAdminClient();
  let query = db.from('teachers').select('*').eq('account_id', accountId);

  if (subject) {
    query = query.ilike('subject', `%${subject}%`);
  }

  const { data: rows } = await query;
  if (!rows || rows.length === 0) {
    // Return sample faculty directory
    return [
      {
        id: 'teach-001',
        accountId,
        name: 'Prof. R. K. Mukherjee',
        specialization:
          'Senior Mathematics & Quantitative Aptitude Faculty (15+ yrs exp)',
        subjects: ['Quantitative Aptitude', 'Advanced Mathematics'],
        experienceYears: 15,
        assignedCourses: ['SSC CGL Foundation', 'Banking Special'],
        isActive: true,
      },
      {
        id: 'teach-002',
        accountId,
        name: 'Dr. Debashis Roy',
        specialization: 'Organic & Inorganic Chemistry Specialist (NEET & JEE)',
        subjects: ['Chemistry'],
        experienceYears: 12,
        assignedCourses: ['NEET Medical Foundation'],
        isActive: true,
      },
    ];
  }

  return rows.map((r) => ({
    id: r.id,
    accountId: r.account_id,
    name: r.name,
    specialization: r.specialization || 'Faculty Member',
    subjects: r.subjects || (r.subject ? [r.subject] : ['General']),
    experienceYears: r.experience_years || 5,
    assignedCourses: r.assigned_courses || [],
    bio: r.bio,
    isActive: r.is_active !== false,
  }));
}
