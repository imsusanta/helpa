import { WorkflowSeed } from '../types';

export const workflowsConfig: WorkflowSeed[] = [
  {
    name: 'Patient Welcome Auto-Reply',
    description: 'Greets new patients instantly upon first contact.',
    trigger_type: 'first_inbound_message',
    trigger_config: {},
    is_active: true,
    steps: [
      {
        step_type: 'send_message',
        step_config: {
          text: "Welcome to our Hospital & Clinic! 🏥 How can we assist you today? You can reply BOOK to request an appointment."
        }
      }
    ]
  }
];
