import { WorkflowSeed } from '../types';

export const workflowsConfig: WorkflowSeed[] = [
  {
    name: 'Fitness Member Greeting',
    description: 'Auto-greets gym membership inquiries.',
    trigger_type: 'first_inbound_message',
    trigger_config: {},
    is_active: true,
    steps: [
      {
        step_type: 'send_message',
        step_config: {
          text: 'Welcome to our Gym & Fitness center! 🏋 Contact us to book a free trial class.',
        },
      },
    ],
  },
];
