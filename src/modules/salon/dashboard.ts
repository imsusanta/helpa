import { DashboardMetricWidget } from '../types';

export const dashboardConfig: DashboardMetricWidget[] = [
  {
    key: 'salon_appointments_today',
    label: "Today's Appointments",
    iconName: 'Calendar',
    queryTable: 'appointments',
    queryType: 'count',
  },
  {
    key: 'salon_customers_total',
    label: 'Total Clients',
    iconName: 'Users',
    queryTable: 'contacts',
    queryType: 'count',
  },
  {
    key: 'salon_active_chats',
    label: 'Client Enquiries',
    iconName: 'MessageSquare',
    queryTable: 'conversations',
    queryType: 'count',
  },
  {
    key: 'salon_revenue',
    label: 'Service Revenue',
    iconName: 'DollarSign',
    queryTable: 'deals',
    queryType: 'sum',
    querySumField: 'value',
  },
];
