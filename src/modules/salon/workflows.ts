import { WorkflowSeed } from '../types';

export const workflowsConfig: WorkflowSeed[] = [
  {
    name: 'Salon Appointment Auto-Confirmation',
    description: 'Sends instant WhatsApp confirmation upon booking a salon slot',
    trigger_type: 'appointment_created',
    trigger_config: {},
    is_active: true,
    steps: [
      {
        type: 'send_whatsapp_message',
        text: 'Hello {{Name}}, your salon appointment has been scheduled! We look forward to pampering you.',
      },
    ],
  },
];
