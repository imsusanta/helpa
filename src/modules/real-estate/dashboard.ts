import { DashboardMetricWidget } from '../types';

export const dashboardConfig: DashboardMetricWidget[] = [
  {
    key: 'leads_new',
    label: 'New Leads',
    iconName: 'Users',
    queryTable: 'realestate_leads',
    queryType: 'count',
  },
  {
    key: 'visits_scheduled',
    label: 'Site Visits',
    iconName: 'Calendar',
    queryTable: 'realestate_visits',
    queryType: 'count',
    queryFilters: [{ field: 'status', operator: 'eq', value: 'scheduled' }],
  },
  {
    key: 'deals_open',
    label: 'Open Deals',
    iconName: 'FileText',
    queryTable: 'deals',
    queryType: 'count',
    queryFilters: [{ field: 'status', operator: 'eq', value: 'open' }],
  },
];
