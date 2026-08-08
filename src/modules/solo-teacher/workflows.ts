import { WorkflowSeed } from '../types';

export const workflowsConfig: WorkflowSeed[] = [
  {
    name: 'Student Inquiry Greeting',
    description: 'Auto-greets new student/parent inquiries.',
    trigger_type: 'first_inbound_message',
    trigger_config: {},
    is_active: true,
    steps: [
      {
        type: 'send_message',
        config: {
          body: 'Hello! 👋 Welcome! I am the AI Teaching Assistant. How can I help you today? Are you looking for course information, batch timings, or fees?',
        },
      },
    ],
  },
  {
    name: 'Enrollment Follow-up',
    description: 'Follows up with students who showed enrollment interest.',
    trigger_type: 'tag_added',
    trigger_config: { tag: 'interested' },
    is_active: true,
    steps: [
      {
        type: 'send_message',
        config: {
          body: 'Hi {{name}}! Just checking in — would you like to proceed with enrollment? I can help you with the next steps. 📚',
        },
      },
    ],
  },
];
