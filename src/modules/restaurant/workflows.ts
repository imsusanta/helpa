import { WorkflowSeed } from '../types';

export const workflowsConfig: WorkflowSeed[] = [
  {
    name: 'Diner Reservation Greeting',
    description: 'Auto-greets dining table reservation inquiries.',
    trigger_type: 'first_inbound_message',
    trigger_config: {},
    is_active: true,
    steps: [
      {
        step_type: 'send_message',
        step_config: {
          text: "Welcome to our Restaurant! 🍽 Tell us your group size and preferred timing to reserve a table."
        }
      }
    ]
  }
];
