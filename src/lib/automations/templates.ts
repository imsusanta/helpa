import type {
  AutomationStepConfig,
  AutomationStepType,
  AutomationTriggerConfig,
  AutomationTriggerType,
} from '@/types';
import { resolveCanonicalIndustry } from '@/modules/registry';

export type TemplateSlug =
  | 'welcome_message'
  | 'out_of_office'
  | 'lead_qualifier'
  | 'follow_up_reminder'
  | 'doctor_booking_enquiry'
  | 'clinic_faq_autoreply'
  | 'urgent_case_escalation'
  | 'report_ready_alert'
  | 'post_visit_feedback'
  | 'prescription_refill'
  | 'lab_test_booking'
  | 'new_lead_instant_reply'
  | 'admission_enquiry'
  | 'property_site_visit'
  | 'course_enquiry'
  | 'table_booking'
  | 'traveler_intake_greeting'
  | 'travel_package_enquiry'
  | 'travel_booking_confirm'
  | 'travel_payment_followup'
  | 'travel_documents_reminder';

export type CanonicalAutomationIndustry =
  | 'hospital_clinic'
  | 'travel'
  | 'restaurant'
  | 'coaching'
  | 'salon'
  | 'real_estate'
  | 'gym'
  | 'solo_teacher'
  | 'general';

const SHARED_INDUSTRIES: readonly CanonicalAutomationIndustry[] = [
  'hospital_clinic',
  'travel',
  'restaurant',
  'coaching',
  'salon',
  'real_estate',
  'gym',
  'solo_teacher',
  'general',
] as const;

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
  industries: readonly CanonicalAutomationIndustry[];
  iconName: string;
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
    industries: SHARED_INDUSTRIES,
    iconName: 'MessageCircle',
    // first_inbound_message (added in PR #33) catches both brand-new
    // contacts AND manually-added/imported contacts on their first-ever
    // reply, which is what a user setting up a "welcome" automation
    // almost always wants. new_contact_created would miss the
    // manually-imported case.
    trigger_type: 'first_inbound_message',
    trigger_config: {},
    // NOTE: this template used to ship an `add_tag` step with an empty
    // `tag_id`. validateStepsForActivation rejects that, so the template
    // could never be switched on without first deleting the step by hand.
    // Tagging is one click away in the builder, so the seed stays clean.
    steps: [
      {
        step_type: 'send_message',
        step_config: {
          text: "Hi! \ud83d\udc4b Thanks for reaching out. We'll get back to you shortly.",
        },
      },
    ],
  },
  out_of_office: {
    slug: 'out_of_office',
    name: 'Out of Office',
    description: 'Auto-reply during off-hours so nobody is left waiting.',
    industries: SHARED_INDUSTRIES,
    iconName: 'Clock',
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
          text: 'Thanks for your message! Our team is offline right now (9am\u20136pm) and will reply first thing tomorrow.',
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
    industries: SHARED_INDUSTRIES,
    iconName: 'Users',
    trigger_type: 'keyword_match',
    trigger_config: {
      keywords: ['pricing', 'price', 'quote', 'buy'],
      match_type: 'contains',
    },
    steps: [
      {
        step_type: 'send_message',
        step_config: {
          text: 'Great \u2014 happy to help with pricing! Quick question: which service or package are you interested in, and when would you like to start?',
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
    industries: SHARED_INDUSTRIES,
    iconName: 'PhoneCall',
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
          text: 'Just circling back \u2014 did you have any other questions for us? Happy to help!',
        },
      },
    ],
  },
  doctor_booking_enquiry: {
    slug: 'doctor_booking_enquiry',
    name: 'Doctor Booking Enquiry',
    description:
      'Starts an AI-assisted appointment flow and keeps the chatbot active until booking.',
    industries: ['hospital_clinic'],
    iconName: 'CalendarDays',
    trigger_type: 'keyword_match',
    trigger_config: {
      keywords: [
        'doctor appointment',
        'book appointment',
        'book doctor',
        'appointment booking',
        'consultation booking',
      ],
      match_type: 'contains',
    },
    steps: [
      {
        step_type: 'send_message',
        step_config: {
          text: "Let's book the doctor appointment. Please reply with the patient's full name, mobile number, gender, date of birth (YYYY-MM-DD), department, preferred doctor, date, and time. The AI receptionist will verify the details and complete the booking.",
        },
      },
    ],
  },
  clinic_faq_autoreply: {
    slug: 'clinic_faq_autoreply',
    name: 'Timing, Fees & Address Reply',
    description:
      'Answers the three questions every clinic gets all day, instantly.',
    industries: ['hospital_clinic'],
    iconName: 'HelpCircle',
    trigger_type: 'keyword_match',
    trigger_config: {
      keywords: [
        'timing',
        'timings',
        'open',
        'address',
        'location',
        'fees',
        'fee',
        'charges',
      ],
      match_type: 'contains',
    },
    steps: [
      {
        step_type: 'send_message',
        step_config: {
          text: 'Here are our clinic details:\n\n\ud83d\udd52 OPD timing: 9:00 AM \u2013 1:00 PM and 5:00 PM \u2013 8:00 PM (edit this)\n\ud83d\udccd Address: add your clinic address here\n\ud83d\udcb0 Consultation fee: add your fee here\n\nReply "book" and we will schedule your appointment.',
        },
      },
    ],
  },
  urgent_case_escalation: {
    slug: 'urgent_case_escalation',
    name: 'Urgent Case Escalation',
    description:
      'Flags emergency wording, replies with safety guidance, and alerts staff.',
    industries: ['hospital_clinic'],
    iconName: 'Siren',
    trigger_type: 'keyword_match',
    trigger_config: {
      keywords: [
        'emergency',
        'urgent',
        'chest pain',
        'bleeding',
        'accident',
        'severe pain',
        'unconscious',
      ],
      match_type: 'contains',
    },
    steps: [
      {
        step_type: 'send_message',
        step_config: {
          text: 'This sounds urgent. If it is a medical emergency, please call our clinic number now or go to the nearest emergency room \u2014 do not wait for a WhatsApp reply. Our team has been alerted and will respond here as soon as possible.',
        },
      },
      {
        step_type: 'assign_conversation',
        step_config: { mode: 'round_robin' },
      },
    ],
  },
  report_ready_alert: {
    slug: 'report_ready_alert',
    name: 'Report Ready Alert',
    description:
      'Tag a patient "Report Ready" and Helpa tells them where to collect it.',
    industries: ['hospital_clinic'],
    iconName: 'FileCheck',
    trigger_type: 'tag_added',
    // The tag is account-specific, so the user picks it in the builder
    // before the automation can be activated.
    trigger_config: { tag_id: '' },
    steps: [
      {
        step_type: 'send_message',
        step_config: {
          text: 'Good news \u2014 your test report is ready. You can collect it from the clinic reception during OPD hours, or reply "send" and we will share the soft copy here.',
        },
      },
    ],
  },
  post_visit_feedback: {
    slug: 'post_visit_feedback',
    name: 'Post-Visit Feedback',
    description:
      'Tag a completed visit and ask for a rating one day later, automatically.',
    industries: ['hospital_clinic'],
    iconName: 'Star',
    trigger_type: 'tag_added',
    // Same as report_ready_alert: the "Visit Done" tag is chosen by the user.
    trigger_config: { tag_id: '' },
    steps: [
      {
        step_type: 'wait',
        step_config: { amount: 1, unit: 'days' },
      },
      {
        step_type: 'send_message',
        step_config: {
          text: 'We hope you are feeling better after your visit. How was your experience with us? Reply with a rating from 1 to 5 \u2014 your feedback helps us improve.',
        },
      },
    ],
  },
  prescription_refill: {
    slug: 'prescription_refill',
    name: 'Prescription Refill',
    description: 'Collects prescription details for repeat medicine requests.',
    industries: ['hospital_clinic'],
    iconName: 'Pill',
    trigger_type: 'keyword_match',
    trigger_config: {
      keywords: [
        'refill',
        'repeat medicine',
        'prescription',
        'medicine order',
        'same medicine',
      ],
      match_type: 'contains',
    },
    steps: [
      {
        step_type: 'send_message',
        step_config: {
          text: 'Sure, we can help with your medicines. Please send a photo of the prescription, the patient name, and which medicines you need refilled. Our team will confirm availability and pickup time.',
        },
      },
      {
        step_type: 'assign_conversation',
        step_config: { mode: 'round_robin' },
      },
    ],
  },
  lab_test_booking: {
    slug: 'lab_test_booking',
    name: 'Lab Test Booking',
    description: 'Captures test name, patient, and slot for diagnostics.',
    industries: ['hospital_clinic'],
    iconName: 'FlaskConical',
    trigger_type: 'keyword_match',
    trigger_config: {
      keywords: [
        'lab test',
        'blood test',
        'x-ray',
        'scan',
        'ultrasound',
        'sample collection',
      ],
      match_type: 'contains',
    },
    steps: [
      {
        step_type: 'send_message',
        step_config: {
          text: 'We can arrange your test. Please share the test name, patient name and age, and your preferred date and time. Home sample collection is available in selected areas.',
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
    industries: SHARED_INDUSTRIES,
    iconName: 'UserPlus',
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
    industries: ['coaching'],
    iconName: 'GraduationCap',
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
    industries: ['real_estate'],
    iconName: 'Building2',
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
    industries: ['coaching', 'solo_teacher'],
    iconName: 'BookOpen',
    trigger_type: 'keyword_match',
    trigger_config: {
      keywords: ['course', 'training', 'class', 'batch'],
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
    industries: ['restaurant'],
    iconName: 'UtensilsCrossed',
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
  traveler_intake_greeting: {
    slug: 'traveler_intake_greeting',
    name: 'Traveler Intake Greeting',
    description: 'Welcome travel enquiries and start trip planning.',
    industries: ['travel'],
    iconName: 'Plane',
    trigger_type: 'first_inbound_message',
    trigger_config: {},
    steps: [
      {
        step_type: 'send_message',
        step_config: {
          text: 'Welcome to our Travel Agency! How can we help you plan your next trip? Tell us the destination, travel dates, and number of guests.',
        },
      },
    ],
  },
  travel_package_enquiry: {
    slug: 'travel_package_enquiry',
    name: 'Tour Package Enquiry',
    description:
      'When a traveller asks about a package, itinerary, or destination, collect trip details for the AI consultant.',
    industries: ['travel'],
    iconName: 'Map',
    trigger_type: 'keyword_match',
    trigger_config: {
      keywords: [
        'tour package',
        'package details',
        'package price',
        'itinerary',
        'destination',
        'trip package',
        'honeymoon package',
        'family trip',
      ],
      match_type: 'contains',
    },
    steps: [
      {
        step_type: 'send_message',
        step_config: {
          text: 'Happy to help with a Tour Package. Please share destination, travel month or dates, number of adults/children, and budget. I will match a real package from our catalog.',
        },
      },
    ],
  },
  travel_booking_confirm: {
    slug: 'travel_booking_confirm',
    name: 'Booking Confirm',
    description:
      'Sends the Booking Confirm template with a Confirm Booking button. Tapping the button creates the trip booking.',
    industries: ['travel'],
    iconName: 'CalendarCheck',
    trigger_type: 'keyword_match',
    trigger_config: {
      keywords: [
        'booking confirm',
        'confirm booking',
        'confirm this booking',
        'confirm this trip',
        'book this package',
        'booking confirmation',
        'confirm the booking',
      ],
      match_type: 'contains',
    },
    steps: [
      {
        step_type: 'send_message',
        step_config: {
          text: 'Please confirm this Travel Booking:\n\nPackage: {{ travel.package_name }}\nTravel date: {{ travel.date }}\nGuests: {{ travel.guests }}\nTotal: {{ travel.total_price }}\n\nTap Confirm Booking to complete. If you do not see the button, reply 1.',
          travel_booking_confirm: true,
          buttons: [
            { id: 'travel_booking_confirm', title: 'Confirm Booking' },
            { id: 'travel_booking_later', title: 'Not yet' },
          ],
        },
      },
    ],
  },
  travel_payment_followup: {
    slug: 'travel_payment_followup',
    name: 'Travel Payment Follow-up',
    description:
      'When a traveller asks about payment or advance, collect payment details and assign the chat.',
    industries: ['travel'],
    iconName: 'Wallet',
    trigger_type: 'keyword_match',
    trigger_config: {
      keywords: [
        'payment',
        'pay now',
        'advance',
        'invoice',
        'token amount',
        'booking amount',
      ],
      match_type: 'contains',
    },
    steps: [
      {
        step_type: 'send_message',
        step_config: {
          text: 'We can share the payment details for this Travel Booking. Please confirm the package name and whether you want to pay the advance or the full amount. Our team will send the official payment link.',
        },
      },
      {
        step_type: 'assign_conversation',
        step_config: { mode: 'round_robin' },
      },
    ],
  },
  travel_documents_reminder: {
    slug: 'travel_documents_reminder',
    name: 'Travel Documents Reminder',
    description:
      'Reminds travellers what documents are needed for visa, tickets, and departure.',
    industries: ['travel'],
    iconName: 'FileText',
    trigger_type: 'keyword_match',
    trigger_config: {
      keywords: ['visa', 'passport', 'documents', 'ticket', 'travel documents'],
      match_type: 'contains',
    },
    steps: [
      {
        step_type: 'send_message',
        step_config: {
          text: 'For this trip please keep these ready: valid passport, visa (if required), traveller names as on passport, and any medical or travel insurance papers. Reply with the destination and travel date if you want a package-specific checklist.',
        },
      },
    ],
  },
};

export function getTemplate(slug: string): AutomationTemplateDefinition | null {
  return AUTOMATION_TEMPLATES[slug as TemplateSlug] ?? null;
}

const TEMPLATE_DISPLAY_ORDER = Object.keys(
  AUTOMATION_TEMPLATES
) as TemplateSlug[];

function canonicalTemplateIndustry(
  industry: string | null | undefined
): CanonicalAutomationIndustry {
  return resolveCanonicalIndustry(
    industry || 'general'
  ) as CanonicalAutomationIndustry;
}

export function getTemplatesForIndustry(
  industry: string | null | undefined
): AutomationTemplateDefinition[] {
  const canonical = canonicalTemplateIndustry(industry);
  return TEMPLATE_DISPLAY_ORDER.filter((slug) =>
    AUTOMATION_TEMPLATES[slug].industries.includes(canonical)
  )
    .sort((a, b) => {
      const aSpecific =
        AUTOMATION_TEMPLATES[a].industries.length < SHARED_INDUSTRIES.length;
      const bSpecific =
        AUTOMATION_TEMPLATES[b].industries.length < SHARED_INDUSTRIES.length;
      if (aSpecific === bSpecific) return 0;
      return aSpecific ? -1 : 1;
    })
    .map((slug) => {
      const template = AUTOMATION_TEMPLATES[slug];
      return {
        ...template,
        industries: [...template.industries],
        trigger_config: { ...template.trigger_config },
        steps: template.steps.map((step) => ({
          ...step,
          step_config: { ...step.step_config },
        })),
      };
    });
}

export function getTemplateForIndustry(
  slug: string,
  industry: string | null | undefined
): AutomationTemplateDefinition | null {
  const template = getTemplate(slug);
  if (!template) return null;
  const canonical = canonicalTemplateIndustry(industry);
  if (!template.industries.includes(canonical)) return null;
  return {
    ...template,
    industries: [...template.industries],
    trigger_config: { ...template.trigger_config },
    steps: template.steps.map((step) => ({
      ...step,
      step_config: { ...step.step_config },
    })),
  };
}
