import { CopilotConfig } from '../types';

export const copilotConfig: CopilotConfig = {
  summaryFields: [
    'gender',
    'date_of_birth',
    'blood_group',
    'emergency_contact',
  ],
  quickActions: [
    { label: 'View Reports', action: 'view_reports', iconName: 'FileText' },
    { label: 'Book Appointment', action: 'book_appt', iconName: 'Calendar' },
  ],
};
