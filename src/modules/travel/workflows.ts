import { WorkflowSeed } from '../types';

export const workflowsConfig: WorkflowSeed[] = [
  {
    seedKey: 'traveler_intake_greeting',
    name: 'Traveler Intake Greeting',
    description: 'Auto-greets traveler inquiries.',
    trigger_type: 'first_inbound_message',
    trigger_config: {},
    is_active: true,
    steps: [
      {
        step_type: 'send_message',
        step_config: {
          text: 'Welcome to our Travel Agency! ✈ How can we help you plan your next trip?',
        },
      },
    ],
  },
];
