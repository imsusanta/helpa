import { DashboardMetricWidget } from '../types';

export const dashboardConfig: DashboardMetricWidget[] = [
  {
    key: 'gym_members',
    label: 'Gym Members',
    iconName: 'Users',
    queryTable: 'conversations',
    queryType: 'count'
  }
];
