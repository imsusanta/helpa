import { DashboardMetricWidget } from '../types';

export const dashboardConfig: DashboardMetricWidget[] = [
  {
    key: 'reservations_today',
    label: 'Reservations',
    iconName: 'Calendar',
    queryTable: 'conversations',
    queryType: 'count',
  },
];
