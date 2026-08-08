import { DashboardMetricWidget } from '../types';

export const dashboardConfig: DashboardMetricWidget[] = [
  {
    key: 'admissions_total',
    label: 'New Admissions',
    iconName: 'Calendar',
    queryTable: 'coaching_admissions',
    queryType: 'count',
    queryFilters: [{ field: 'status', operator: 'eq', value: 'active' }],
  },
  {
    key: 'student_leads',
    label: 'Student Enquiries',
    iconName: 'MessageSquare',
    queryTable: 'coaching_students',
    queryType: 'count',
    queryFilters: [{ field: 'status', operator: 'eq', value: 'active' }],
  },
  {
    key: 'courses_active',
    label: 'Course Enquiries',
    iconName: 'FileText',
    queryTable: 'coaching_courses',
    queryType: 'count',
  },
];
