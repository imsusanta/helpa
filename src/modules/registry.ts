import { IndustryModule } from './types';
import { healthModule } from './health';
import { coachingModule } from './coaching';
import { realEstateModule } from './real-estate';
import { travelModule } from './travel';
import { gymModule } from './gym';
import { restaurantModule } from './restaurant';
import { soloTeacherModule } from './solo-teacher';
import { salonModule } from './salon';
import {
  getIndustryTerminology,
  INDUSTRY_ALIASES,
  resolveIndustryAlias,
} from './terminology';

export const INDUSTRY_REGISTRY: Record<string, IndustryModule> = {
  hospital_clinic: healthModule,
  health: healthModule,
  coaching: coachingModule,
  real_estate: realEstateModule,
  travel: travelModule,
  gym: gymModule,
  restaurant: restaurantModule,
  solo_teacher: soloTeacherModule,
  salon: salonModule,
};

export { INDUSTRY_ALIASES };

export interface BusinessTypeOption {
  id: string;
  label: string;
  description: string;
  emoji: string;
  iconName: string;
}

export const BUSINESS_TYPE_OPTIONS: readonly BusinessTypeOption[] = [
  {
    id: 'hospital_clinic',
    label: 'Health',
    description: 'Clinics, hospitals and healthcare businesses.',
    emoji: '🏥',
    iconName: 'Activity',
  },
  {
    id: 'travel',
    label: 'Travel',
    description: 'Travel agencies, tour operators and travel businesses.',
    emoji: '✈️',
    iconName: 'Plane',
  },
  {
    id: 'restaurant',
    label: 'Restaurant',
    description: 'Restaurants, cafes and food businesses.',
    emoji: '🍽️',
    iconName: 'UtensilsCrossed',
  },
  {
    id: 'coaching',
    label: 'Education',
    description:
      'Coaching centers, institutes, tutors and education businesses.',
    emoji: '🎓',
    iconName: 'GraduationCap',
  },
  {
    id: 'salon',
    label: 'Salon',
    description: 'Salons, spas and beauty businesses.',
    emoji: '💇',
    iconName: 'Scissors',
  },
  {
    id: 'real_estate',
    label: 'Real Estate',
    description: 'Property dealers, brokers and real estate agencies.',
    emoji: '🏠',
    iconName: 'Building2',
  },
  {
    id: 'gym',
    label: 'Fitness',
    description: 'Gyms, fitness centers and trainers.',
    emoji: '🏋️',
    iconName: 'Dumbbell',
  },
  {
    id: 'general',
    label: 'Other Business',
    description: 'Other businesses and professional services.',
    emoji: '💼',
    iconName: 'Briefcase',
  },
] as const;

export function isValidIndustry(industry: unknown): boolean {
  if (!industry || typeof industry !== 'string') return false;
  const normalized = industry.trim().toLowerCase();
  if (normalized === 'general' || normalized === 'other') return true;
  return Boolean(INDUSTRY_ALIASES[normalized] || INDUSTRY_REGISTRY[normalized]);
}

export function resolveCanonicalIndustry(industry: string): string {
  return resolveIndustryAlias(industry);
}

// Fallback module definition for 'general' or others
export const generalModule: IndustryModule = {
  id: 'general',
  name: 'General CRM',
  description: 'AI General Assistant',
  status: 'ACTIVE',
  terminology: getIndustryTerminology('general'),

  sidebar: [
    { href: '/dashboard', label: 'Dashboard', iconName: 'LayoutDashboard' },
    { href: '/inbox', label: 'WhatsApp Chats', iconName: 'MessageSquare' },
    { href: '/contacts', label: 'Contacts', iconName: 'Users' },
    {
      href: '/broadcasts',
      label: 'Campaigns',
      iconName: 'Megaphone',
      roleMin: 'admin',
    },
    { href: '/knowledge-base', label: 'Knowledge', iconName: 'FileText' },
    { href: '/settings', label: 'Settings', iconName: 'Settings' },
  ],

  dashboardMetrics: [
    {
      key: 'conversations_active',
      label: 'Active Chats',
      iconName: 'MessageSquare',
      queryTable: 'conversations',
      queryType: 'count',
    },
  ],

  systemPrompt:
    'You are acting as a helpful and polite AI Assistant. Assist the client with generic details and hand off to human agents when requested.',

  kbTemplates: [
    {
      category: 'faq',
      questionTitle: 'Company Hours',
      answerContent: 'We are open Monday to Friday from 9:00 AM to 6:00 PM.',
    },
  ],

  campaignTemplates: [
    {
      name: 'General Offer Newsletter',
      category: 'General Announcement',
      messageBody:
        'Hello {{Name}}, thank you for being a valued customer. Check out our website for updates!',
      ctaType: 'none',
    },
  ],

  copilotConfig: {
    summaryFields: ['status'],
    quickActions: [],
  },

  pipelineStages: [
    { name: 'New Lead', position: 1, color: '#3b82f6' },
    { name: 'Won', position: 2, color: '#10b981' },
    { name: 'Lost', position: 3, color: '#ef4444' },
  ],
  workflows: [],
  entityConfigs: {
    contacts: {
      tableName: 'contacts',
      label: 'Contact',
      pluralLabel: 'Contacts',
      fields: [],
    },
  },
};

export function getIndustryModule(
  industry: string | null | undefined
): IndustryModule {
  const industryKey = resolveIndustryAlias(industry);
  return INDUSTRY_REGISTRY[industryKey] || generalModule;
}

/**
 * A workspace may override its default industry instructions. Empty or
 * missing overrides must still resolve to the appropriate industry prompt.
 */
export function resolveSystemPrompt(
  industry: string | null | undefined,
  customPrompt: string | null | undefined
): string {
  const prompt = customPrompt?.trim();
  return prompt || getIndustryModule(industry).systemPrompt;
}
export * from './types';
export * from './registry';
