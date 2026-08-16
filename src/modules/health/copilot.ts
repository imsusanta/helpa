import { CopilotConfig } from '../types';

export const copilotConfig: CopilotConfig = {
  summaryFields: ['patient_id', 'blood_group', 'emergency_contact', 'allergies', 'medical_notes'],
  quickActions: [
    {
      label: 'Book Consultation',
      action: 'book_doctor_appointment',
      iconName: 'Calendar',
    },
    {
      label: 'Send Lab Report',
      action: 'dispatch_lab_report',
      iconName: 'FileText',
    },
    {
      label: 'Doctor Availability',
      action: 'check_doctor_schedule',
      iconName: 'UserCheck',
    },
  ],
};
