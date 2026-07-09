import { CopilotConfig } from '../types';

export const copilotConfig: CopilotConfig = {
  summaryFields: ['budget', 'preferred_location', 'status'],
  quickActions: [
    { label: 'Schedule Visit', action: 'schedule_visit', iconName: 'Calendar' },
    { label: 'View Properties', action: 'view_properties', iconName: 'FileText' },
  ]
};
