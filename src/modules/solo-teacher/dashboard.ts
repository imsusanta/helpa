import { DashboardMetricWidget } from '../types';

export const dashboardConfig: DashboardMetricWidget[] = [
  {
    key: 'todays_conversations',
    label: "Today's Conversations",
    iconName: 'MessageSquare',
    queryTable: 'conversations',
    queryType: 'count',
    queryFilters: [{ field: 'created_at', operator: 'gte', value: 'today' }],
  },
  {
    key: 'new_enquiries',
    label: 'New Student Enquiries',
    iconName: 'Users',
    queryTable: 'contacts',
    queryType: 'count',
    queryFilters: [{ field: 'created_at', operator: 'gte', value: 'today' }],
  },
  {
    key: 'active_students',
    label: 'Active Students',
    iconName: 'UserCheck',
    queryTable: 'contacts',
    queryType: 'count',
  },
  {
    key: 'pending_enrollments',
    label: 'Pending Enrollments',
    iconName: 'Calendar',
    queryTable: 'deals',
    queryType: 'count',
    queryFilters: [{ field: 'status', operator: 'eq', value: 'open' }],
  },
];
