import { DashboardMetricWidget } from '../types';

export const dashboardConfig: DashboardMetricWidget[] = [
  {
    key: 'appointments_today',
    label: "Today's Appointments",
    iconName: 'Calendar',
    queryTable: 'appointments',
    queryType: 'count',
    queryFilters: [
      { field: 'appointment_date', operator: 'eq', value: 'TODAY' }
    ]
  },
  {
    key: 'conversations_active',
    label: "Today's Conversations",
    iconName: 'MessageSquare',
    queryTable: 'conversations',
    queryType: 'count',
    queryFilters: [
      { field: 'status', operator: 'eq', value: 'open' }
    ]
  },
  {
    key: 'doctors_active',
    label: "Doctors Available",
    iconName: 'UserCheck',
    queryTable: 'hospital_doctors',
    queryType: 'count',
    queryFilters: [
      { field: 'status', operator: 'eq', value: 'active' }
    ]
  },
];
