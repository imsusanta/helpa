import { WorkflowSeed } from '../types';

export const workflowsConfig: WorkflowSeed[] = [
  {
    seedKey: 'student_intake_greeting',
    name: 'Student Intake Greeting',
    description: 'Auto-greets student/parent inquiries.',
    trigger_type: 'first_inbound_message',
    trigger_config: {},
    is_active: true,
    steps: [
      {
        step_type: 'send_message',
        step_config: {
          text: 'Welcome to our Coaching Institute! 🏫 How can we help you with your studies or exam preparation today?',
        },
      },
    ],
  },
];
