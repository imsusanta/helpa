import { IndustryModule } from './types';
import { hospitalModule } from './hospital';
import { coachingModule } from './coaching';
import { realEstateModule } from './real-estate';
import { travelModule } from './travel';
import { gymModule } from './gym';
import { restaurantModule } from './restaurant';
import { soloTeacherModule } from './solo-teacher';

export const INDUSTRY_REGISTRY: Record<string, IndustryModule> = {
  hospital_clinic: hospitalModule,
  coaching: coachingModule,
  real_estate: realEstateModule,
  travel: travelModule,
  gym: gymModule,
  restaurant: restaurantModule,
  solo_teacher: soloTeacherModule,
};

const INDUSTRY_ALIASES: Record<string, keyof typeof INDUSTRY_REGISTRY> = {
  hospital: 'hospital_clinic',
  clinic: 'hospital_clinic',
  healthcare: 'hospital_clinic',
  medical: 'hospital_clinic',
  hospital_clinic: 'hospital_clinic',
  hospital_and_clinic: 'hospital_clinic',
  doctor: 'hospital_clinic',
  pathology: 'hospital_clinic',
};

// Fallback module definition for 'general' or others
export const generalModule: IndustryModule = {
  id: 'general',
  name: 'General CRM',
  description: 'AI General Assistant',

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
  if (!industry) return generalModule;
  const industryKey = INDUSTRY_ALIASES[industry] || industry;
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
