import { CopilotConfig } from '../types';

export const copilotConfig: CopilotConfig = {
  summaryFields: ['status', 'course_interest', 'enrollment_status', 'payment_status', 'last_interaction'],
  quickActions: [
    { label: 'Share Course Info', action: 'share_course_info', iconName: 'BookOpen' },
    { label: 'Check Enrollment', action: 'check_enrollment', iconName: 'Calendar' },
    { label: 'Send Fee Details', action: 'send_fee_details', iconName: 'FileText' },
  ]
};
