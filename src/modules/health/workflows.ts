import { WorkflowSeed } from '../types';

export const workflowsConfig: WorkflowSeed[] = [
  {
    name: 'Doctor Appointment Instant Confirmation',
    description:
      'Sends instant WhatsApp confirmation and token number upon appointment scheduling',
    trigger_type: 'appointment_created',
    trigger_config: {},
    is_active: true,
    steps: [
      {
        type: 'send_whatsapp_message',
        text: 'Dear {{Name}}, your consultation appointment has been scheduled with {{DoctorName}} for {{AppointmentTime}}. Your Token # is {{TokenNumber}}.',
      },
    ],
  },
  {
    name: 'Post-Consultation Prescription & Feedback',
    description:
      'Sends doctor prescription link and feedback request 2 hours after appointment',
    trigger_type: 'appointment_completed',
    trigger_config: { delay_minutes: 120 },
    is_active: true,
    steps: [
      {
        type: 'send_whatsapp_message',
        text: 'Dear {{Name}}, thank you for visiting us today. How was your consultation experience with Dr. {{DoctorName}}?',
      },
    ],
  },
];
