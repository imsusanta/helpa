import type {
  AutomationStepConfig,
  AutomationStepType,
  AutomationTriggerConfig,
  AutomationTriggerType,
} from '@/types';

export type TemplateSlug =
  | 'welcome_message'
  | 'out_of_office'
  | 'lead_qualifier'
  | 'follow_up_reminder'
  | 'doctor_booking_enquiry'
  | 'new_lead_instant_reply'
  | 'admission_enquiry'
  | 'property_site_visit'
  | 'course_enquiry'
  | 'table_booking';

export interface TemplateStepSeed {
  step_type: AutomationStepType;
  step_config: AutomationStepConfig;
  branch?: 'yes' | 'no' | null;
  /** Index (within this seed list) of the Condition parent, if nested. */
  parent_index?: number | null;
}

export interface AutomationTemplateDefinition {
  slug: TemplateSlug;
  name: string;
  description: string;
  trigger_type: AutomationTriggerType;
  trigger_config: AutomationTriggerConfig;
  steps: TemplateStepSeed[];
}

export const AUTOMATION_TEMPLATES: Record<
  TemplateSlug,
  AutomationTemplateDefinition
> = {
  welcome_message: {
    slug: 'welcome_message',
    name: 'Welcome Message',
    description: 'Auto-reply to first-time contacts with a greeting.',
    // first_inbound_message (added in PR #33) catches both brand-new
    // contacts AND manually-added/imported contacts on their first-ever
    // reply, which is what a user setting up a "welcome" automation
    // almost always wants. new_contact_created would miss the
    // manually-imported case.
    trigger_type: 'first_inbound_message',
    trigger_config: {},
    steps: [
      {
        step_type: 'send_message',
        step_config: {
          text: "Hi! 👋 Thanks for reaching out. We'll get back to you shortly.",
        },
      },
      {
        step_type: 'add_tag',
        step_config: { tag_id: '' },
      },
    ],
  },
  out_of_office: {
    slug: 'out_of_office',
    name: 'Out of Office',
    description: 'Auto-reply during off-hours so nobody is left waiting.',
    trigger_type: 'new_message_received',
    trigger_config: {},
    steps: [
      {
        step_type: 'condition',
        step_config: {
          subject: 'time_of_day',
          operand: '18:00-09:00',
        },
      },
      {
        step_type: 'send_message',
        step_config: {
          text: 'Thanks for your message! Our team is offline right now (9am–6pm) and will reply first thing tomorrow.',
        },
        parent_index: 0,
        branch: 'yes',
      },
    ],
  },
  lead_qualifier: {
    slug: 'lead_qualifier',
    name: 'Lead Qualifier',
    description: 'Ask qualification questions to filter inbound leads.',
    trigger_type: 'keyword_match',
    trigger_config: {
      keywords: ['pricing', 'quote', 'buy'],
      match_type: 'contains',
    },
    steps: [
      {
        step_type: 'send_message',
        step_config: {
          text: 'Great — happy to help with pricing! Quick question: roughly how many seats are you looking for?',
        },
      },
      {
        step_type: 'wait',
        step_config: { amount: 10, unit: 'minutes' },
      },
      {
        step_type: 'assign_conversation',
        step_config: { mode: 'round_robin' },
      },
    ],
  },
  follow_up_reminder: {
    slug: 'follow_up_reminder',
    name: 'Follow-up Reminder',
    description: 'Send a nudge if a contact has not replied within 24 hours.',
    trigger_type: 'new_message_received',
    trigger_config: {},
    steps: [
      {
        step_type: 'wait',
        step_config: { amount: 1, unit: 'days' },
      },
      {
        step_type: 'send_message',
        step_config: {
          text: 'Just circling back — did you have any other questions for us? Happy to help!',
        },
      },
    ],
  },
  doctor_booking_enquiry: {
    slug: 'doctor_booking_enquiry',
    name: 'Doctor Booking Enquiry',
    description:
      'Collect appointment preferences and route the patient to staff.',
    trigger_type: 'keyword_match',
    trigger_config: {
      keywords: ['doctor', 'appointment', 'book doctor', 'consultation'],
      match_type: 'contains',
    },
    steps: [
      {
        step_type: 'send_message',
        step_config: {
          text: "Thanks for contacting us about a doctor appointment. Please share the patient's name, preferred doctor or department, and preferred date and time.",
        },
      },
      {
        step_type: 'assign_conversation',
        step_config: { mode: 'round_robin' },
      },
    ],
  },
  new_lead_instant_reply: {
    slug: 'new_lead_instant_reply',
    name: 'New Lead Instant Reply',
    description: 'Acknowledge every new form lead and assign it to the team.',
    trigger_type: 'form_submitted',
    trigger_config: {},
    steps: [
      {
        step_type: 'send_message',
        step_config: {
          text: "Thanks for your enquiry! We've received your details. A team member will contact you shortly.",
        },
      },
      {
        step_type: 'assign_conversation',
        step_config: { mode: 'round_robin' },
      },
    ],
  },
  admission_enquiry: {
    slug: 'admission_enquiry',
    name: 'Admission Enquiry',
    description:
      'Capture admission details for schools, colleges, and institutes.',
    trigger_type: 'keyword_match',
    trigger_config: {
      keywords: ['admission', 'enrolment', 'enrollment', 'apply'],
      match_type: 'contains',
    },
    steps: [
      {
        step_type: 'send_message',
        step_config: {
          text: 'Thank you for your admission enquiry. Please share the student name, preferred course or class, and academic year so our admissions team can help.',
        },
      },
      {
        step_type: 'assign_conversation',
        step_config: { mode: 'round_robin' },
      },
    ],
  },
  property_site_visit: {
    slug: 'property_site_visit',
    name: 'Property Site Visit',
    description: 'Collect visit preferences and route property enquiries.',
    trigger_type: 'keyword_match',
    trigger_config: {
      keywords: ['site visit', 'property visit', 'book visit', 'flat'],
      match_type: 'contains',
    },
    steps: [
      {
        step_type: 'send_message',
        step_config: {
          text: 'Happy to arrange a site visit. Please share the property or location you are interested in, your preferred date and time, and your budget range.',
        },
      },
      {
        step_type: 'assign_conversation',
        step_config: { mode: 'round_robin' },
      },
    ],
  },
  course_enquiry: {
    slug: 'course_enquiry',
    name: 'Course Enquiry',
    description: 'Answer training enquiries and collect course preferences.',
    trigger_type: 'keyword_match',
    trigger_config: {
      keywords: ['course', 'fees', 'training', 'class'],
      match_type: 'contains',
    },
    steps: [
      {
        step_type: 'send_message',
        step_config: {
          text: 'Thanks for your interest in our courses. Please tell us which course you want, your preferred batch timing, and whether you prefer online or offline classes.',
        },
      },
      {
        step_type: 'assign_conversation',
        step_config: { mode: 'round_robin' },
      },
    ],
  },
  table_booking: {
    slug: 'table_booking',
    name: 'Table Booking',
    description: 'Capture restaurant reservation details automatically.',
    trigger_type: 'keyword_match',
    trigger_config: {
      keywords: ['book table', 'reservation', 'table booking', 'reserve'],
      match_type: 'contains',
    },
    steps: [
      {
        step_type: 'send_message',
        step_config: {
          text: 'We can help with your table reservation. Please share the date, time, number of guests, and your name.',
        },
      },
      {
        step_type: 'assign_conversation',
        step_config: { mode: 'round_robin' },
      },
    ],
  },
};

export function getTemplate(slug: string): AutomationTemplateDefinition | null {
  return AUTOMATION_TEMPLATES[slug as TemplateSlug] ?? null;
}
