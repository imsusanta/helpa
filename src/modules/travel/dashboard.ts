import { DashboardMetricWidget } from '../types';

export const dashboardConfig: DashboardMetricWidget[] = [
  {
    key: 'bookings_count',
    label: 'Trip Bookings',
    iconName: 'Calendar',
    queryTable: 'conversations',
    queryType: 'count'
  }
];
