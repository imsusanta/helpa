/**
 * Industry AI presets — suggested (not fabricated) copy used to tailor the
 * Automation & AI surfaces per workspace industry.
 *
 * These are static configuration/templates (like `kbTemplates` in the module
 * registry), NOT statistics. They provide example questions, capability copy
 * and greeting suggestions so the Chatbot / FAQ Bot / AI Assistant pages read
 * naturally for each industry. Nothing here is presented as live data.
 */
import {
  resolveIndustryAlias,
  type CanonicalIndustry,
} from '@/modules/terminology';

export interface IndustryAiPreset {
  /** Human label for the assistant's role, e.g. "AI Receptionist". */
  assistantRole: string;
  /** A suggested welcome/greeting the workspace can adopt as its own. */
  suggestedGreeting: string;
  /** Example inbound questions this industry's bot commonly handles. */
  sampleQuestions: string[];
  /** Short capability statements shown as "what your bot can do". */
  capabilities: string[];
}

const PRESETS: Record<CanonicalIndustry, IndustryAiPreset> = {
  hospital_clinic: {
    assistantRole: 'AI Receptionist',
    suggestedGreeting:
      'Hello! 👋 Welcome to our clinic. I can help you with appointments, doctor availability, consultation fees and general queries. How can I help you today?',
    sampleQuestions: [
      'What are your OPD timings?',
      'How do I book an appointment with a doctor?',
      'What are the consultation fees?',
    ],
    capabilities: [
      'Answer appointment, timing and department queries',
      'Share consultation fees and available treatments',
      'Collect patient details for a callback or booking',
    ],
  },
  coaching: {
    assistantRole: 'AI Admissions Assistant',
    suggestedGreeting:
      'Hi! 👋 Welcome to our institute. I can tell you about courses, batches, fees and admissions. What would you like to know?',
    sampleQuestions: [
      'Which courses and batches are available?',
      'What are the tuition fees?',
      'When does the next batch start?',
    ],
    capabilities: [
      'Explain courses, batches and schedules',
      'Share fees and admission requirements',
      'Capture student enquiries for follow-up',
    ],
  },
  solo_teacher: {
    assistantRole: 'AI Teaching Assistant',
    suggestedGreeting:
      'Hello! 👋 Thanks for reaching out. I can share class timings, course details and fees, and help you book a class. How can I help?',
    sampleQuestions: [
      'What subjects and courses do you teach?',
      'What are your class timings?',
      'How much are the fees per month?',
    ],
    capabilities: [
      'Share course, timing and fee details',
      'Answer common student questions instantly',
      'Capture new student enquiries',
    ],
  },
  salon: {
    assistantRole: 'AI Booking Assistant',
    suggestedGreeting:
      'Hi there! 💇 Welcome. I can help you check services, prices and stylist availability, and book an appointment. What can I do for you?',
    sampleQuestions: [
      'What services do you offer and at what price?',
      'Can I book an appointment for this weekend?',
      'Which stylists are available today?',
    ],
    capabilities: [
      'Share services, pricing and offers',
      'Help clients book appointments',
      'Answer availability and timing questions',
    ],
  },
  gym: {
    assistantRole: 'AI Membership Assistant',
    suggestedGreeting:
      'Hey! 💪 Welcome. I can tell you about membership plans, class schedules and trainers, and help you get started. How can I help?',
    sampleQuestions: [
      'What membership plans do you have?',
      'What are the class timings?',
      'Do you offer personal training?',
    ],
    capabilities: [
      'Explain membership plans and pricing',
      'Share class schedules and trainer details',
      'Capture membership enquiries',
    ],
  },
  restaurant: {
    assistantRole: 'AI Reservations Host',
    suggestedGreeting:
      'Hello! 🍽️ Welcome. I can help with reservations, our menu, timings and directions. How can I assist you today?',
    sampleQuestions: [
      'Can I book a table for tonight?',
      'What is on the menu?',
      'What are your opening hours?',
    ],
    capabilities: [
      'Take and confirm reservation requests',
      'Share menu, pricing and timings',
      'Answer location and availability queries',
    ],
  },
  travel: {
    assistantRole: 'AI Travel Consultant',
    suggestedGreeting:
      'Hi! ✈️ Welcome. I can help you explore tour packages, prices and availability, and plan your trip. Where would you like to go?',
    sampleQuestions: [
      'What tour packages do you offer?',
      'How much is a trip to [destination]?',
      'What is included in the package?',
    ],
    capabilities: [
      'Share tour packages, pricing and inclusions',
      'Answer booking and availability questions',
      'Capture traveller enquiries for follow-up',
    ],
  },
  real_estate: {
    assistantRole: 'AI Property Assistant',
    suggestedGreeting:
      'Hello! 🏠 Welcome. I can share property listings, pricing and availability, and arrange a site visit. What are you looking for?',
    sampleQuestions: [
      'What properties are available in my budget?',
      'Can I schedule a site visit?',
      'What is the price per square foot?',
    ],
    capabilities: [
      'Share property listings and pricing',
      'Help schedule site visits',
      'Capture and qualify property leads',
    ],
  },
  general: {
    assistantRole: 'AI Receptionist',
    suggestedGreeting:
      'Hello! 👋 Thanks for messaging us. I can answer your questions about our products, services, pricing and hours. How can I help you today?',
    sampleQuestions: [
      'What services do you offer?',
      'What are your business hours?',
      'How much do your services cost?',
    ],
    capabilities: [
      'Answer product, service and pricing questions',
      'Share business hours and contact details',
      'Capture new enquiries for your team',
    ],
  },
};

export function getIndustryAiPreset(
  industry?: string | null
): IndustryAiPreset {
  return PRESETS[resolveIndustryAlias(industry)];
}
