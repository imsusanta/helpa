import { DashboardMetricWidget } from '../types';

export const dashboardConfig: DashboardMetricWidget[] = [
  {
    key: 'appointments_today',
    label: "Today's Appointments",
    iconName: 'Calendar',
    queryTable: 'appointments',
    queryType: 'count',
  },
  {
    key: 'active_patients',
    label: 'Total Registered Patients',
    iconName: 'Users',
    queryTable: 'patients',
    queryType: 'count',
  },
  {
    key: 'pending_reports',
    label: 'Pending Lab Reports',
    iconName: 'FileText',
    queryTable: 'lab_reports',
    queryType: 'count',
    queryFilters: [{ field: 'status', operator: 'eq', value: 'pending' }],
  },
  {
    key: 'active_doctors',
    label: 'Doctors On Duty',
    iconName: 'UserCheck',
    queryTable: 'hospital_doctors',
    queryType: 'count',
    queryFilters: [{ field: 'is_active', operator: 'eq', value: true }],
  },
];
