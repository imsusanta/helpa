import { CopilotConfig } from '../types';

export const copilotConfig: CopilotConfig = {
  summaryFields: ['gender', 'date_of_birth', 'parent_name', 'status'],
  quickActions: [
    {
      label: 'Register Course',
      action: 'register_course',
      iconName: 'FileText',
    },
    { label: 'Select Batch', action: 'select_batch', iconName: 'Calendar' },
  ],
};
