import { WorkflowSeed } from '../types';

export const workflowsConfig: WorkflowSeed[] = [
  {
    seedKey: 'property_inquirer_auto_reply',
    name: 'Property Inquirer Auto-Reply',
    description: 'Auto-greets buyer inquiries.',
    trigger_type: 'first_inbound_message',
    trigger_config: {},
    is_active: true,
    steps: [
      {
        step_type: 'send_message',
        step_config: {
          text: 'Welcome to our Real Estate Agency! 🏠 Tell us about your budget or preferred location so we can suggest matching properties.',
        },
      },
    ],
  },
];
