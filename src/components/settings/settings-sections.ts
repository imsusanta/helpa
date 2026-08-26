import {
  Coins,
  FileText,
  LayoutGrid,
  Palette,
  PlugZap,
  Shield,
  Tags,
  User,
  UsersRound,
  Brain,
  CreditCard,
  BellRing,
  MessageSquare,
  Database,
  type LucideIcon,
} from 'lucide-react';
import { resolveIndustryAlias } from '@/modules/terminology';

/**
 * Settings information architecture for the redesigned page.
 *
 * The flat tab strip became a grouped left rail with a new Overview
 * landing. The URL query param stays `?tab=` (deep-linkable, and it
 * keeps the existing links in sidebar.tsx / header.tsx working) — we
 * just map the old values onto the new sections.
 */
export const SETTINGS_SECTIONS = [
  'overview',
  'profile',
  'security',
  'appearance',
  'billing',
  'whatsapp',
  'welcome',
  'templates',
  'fields',
  'deals',
  'members',
  'ai',
  'kb',
  'insurance',
  'reminders',
  'booking_form',
] as const;

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

export const DEFAULT_SECTION: SettingsSection = 'overview';

/** Rail grouping. `adminOnly` items are hidden for non-admins. */
export interface SectionMeta {
  id: SettingsSection;
  label: string;
  icon: LucideIcon;
  group: 'top' | 'account' | 'workspace';
}

/* ------------------------------------------------------------------ */
/*  Industry-aware label overrides                                     */
/* ------------------------------------------------------------------ */

/** Per-industry label overrides for workspace settings sections. */
interface IndustryLabels {
  fields: string;
  deals: string;
  ai: string;
  kb: string;
  reminders: string;
}

const INDUSTRY_LABELS: Record<string, IndustryLabels> = {
  hospital_clinic: {
    fields: 'Patient Custom Fields',
    deals: 'Currency & Billing',
    ai: 'AI Receptionist',
    kb: 'Hospital Info & FAQs',
    reminders: 'Smart Reminders',
  },
  coaching: {
    fields: 'Student Custom Fields',
    deals: 'Currency & Pricing',
    ai: 'AI Counselor',
    kb: 'Institute Info & FAQs',
    reminders: 'Smart Reminders',
  },
  real_estate: {
    fields: 'Lead Custom Fields',
    deals: 'Currency & Pipeline',
    ai: 'AI Sales Assistant',
    kb: 'Property Info & FAQs',
    reminders: 'Smart Reminders',
  },
  travel: {
    fields: 'Traveler Custom Fields',
    deals: 'Currency & Rates',
    ai: 'AI Travel Assistant',
    kb: 'Travel Info & FAQs',
    reminders: 'Smart Reminders',
  },
  gym: {
    fields: 'Member Custom Fields',
    deals: 'Currency & Billing',
    ai: 'AI Fitness Assistant',
    kb: 'Gym Info & FAQs',
    reminders: 'Smart Reminders',
  },
  restaurant: {
    fields: 'Guest Custom Fields',
    deals: 'Currency & Pricing',
    ai: 'AI Reservation Assistant',
    kb: 'Restaurant Info & FAQs',
    reminders: 'Smart Reminders',
  },
  solo_teacher: {
    fields: 'Student Custom Fields',
    deals: 'Currency & Tuition',
    ai: 'AI Teaching Assistant',
    kb: 'Course Info & FAQs',
    reminders: 'Smart Reminders',
  },
  salon: {
    fields: 'Client Custom Fields',
    deals: 'Currency & Services',
    ai: 'AI Salon Receptionist',
    kb: 'Salon Info & FAQs',
    reminders: 'Smart Reminders',
  },
};

const DEFAULT_LABELS: IndustryLabels = {
  fields: 'Contact Custom Fields',
  deals: 'Currency Settings',
  ai: 'AI Receptionist',
  kb: 'Business Info & FAQs',
  reminders: 'Smart Reminders',
};

function getLabels(industry: string | null | undefined): IndustryLabels {
  const canonical = resolveIndustryAlias(industry);
  return INDUSTRY_LABELS[canonical] || DEFAULT_LABELS;
}

/** Sections that are only visible for certain industries. */
const INDUSTRY_ONLY_SECTIONS: Partial<Record<SettingsSection, string[]>> = {
  insurance: ['hospital_clinic'],
};

/**
 * Returns true if the section should be visible for the given industry.
 */
export function isSectionVisible(
  section: SettingsSection,
  industry: string | null | undefined
): boolean {
  const allowed = INDUSTRY_ONLY_SECTIONS[section];
  if (!allowed) return true;
  const canonical = resolveIndustryAlias(industry);
  return allowed.includes(canonical);
}

/**
 * Build the section metadata dynamically based on the active industry.
 */
export function getSectionMeta(
  industry: string | null | undefined
): Record<SettingsSection, SectionMeta> {
  const labels = getLabels(industry);

  return {
    overview: {
      id: 'overview',
      label: 'Overview',
      icon: LayoutGrid,
      group: 'top',
    },
    profile: {
      id: 'profile',
      label: 'Your profile',
      icon: User,
      group: 'account',
    },
    security: {
      id: 'security',
      label: 'Login & security',
      icon: Shield,
      group: 'account',
    },
    appearance: {
      id: 'appearance',
      label: 'Appearance',
      icon: Palette,
      group: 'account',
    },
    billing: {
      id: 'billing',
      label: 'Billing & Plans',
      icon: CreditCard,
      group: 'account',
    },
    whatsapp: {
      id: 'whatsapp',
      label: 'WhatsApp',
      icon: PlugZap,
      group: 'workspace',
    },
    welcome: {
      id: 'welcome',
      label: 'Welcome Message',
      icon: MessageSquare,
      group: 'workspace',
    },
    templates: {
      id: 'templates',
      label: 'Templates',
      icon: FileText,
      group: 'workspace',
    },
    fields: {
      id: 'fields',
      label: labels.fields,
      icon: Tags,
      group: 'workspace',
    },
    deals: {
      id: 'deals',
      label: labels.deals,
      icon: Coins,
      group: 'workspace',
    },
    members: {
      id: 'members',
      label: 'Team members',
      icon: UsersRound,
      group: 'workspace',
    },
    ai: { id: 'ai', label: labels.ai, icon: Brain, group: 'workspace' },
    kb: { id: 'kb', label: labels.kb, icon: Database, group: 'workspace' },
    insurance: {
      id: 'insurance',
      label: 'Health Insurance',
      icon: Shield,
      group: 'workspace',
    },
    reminders: {
      id: 'reminders',
      label: labels.reminders,
      icon: BellRing,
      group: 'workspace',
    },
    booking_form: {
      id: 'booking_form',
      label: 'Booking Form Settings',
      icon: FileText,
      group: 'workspace',
    },
  };
}

/** @deprecated Use getSectionMeta(industry) instead. Kept for backward compat. */
export const SECTION_META = getSectionMeta(null);

export const RAIL_GROUPS: {
  label: string | null;
  group: SectionMeta['group'];
}[] = [
  { label: null, group: 'top' },
  { label: 'Account', group: 'account' },
  { label: 'Workspace', group: 'workspace' },
];

function isSection(value: string | null): value is SettingsSection {
  return !!value && (SETTINGS_SECTIONS as readonly string[]).includes(value);
}

/**
 * Resolve a raw `?tab=` value to a section. Legacy tabs from the old
 * flat layout collapse onto their new home (Tags + Custom fields → the
 * merged "Fields & tags" section). Anything unknown falls back to the
 * Overview landing.
 */
export function resolveSection(raw: string | null): SettingsSection {
  if (!raw) return DEFAULT_SECTION;
  const clean = raw.toLowerCase().replace(/-/g, '_');
  if (
    clean === 'tags' ||
    clean === 'custom_fields' ||
    clean === 'columns' ||
    clean === 'consent'
  )
    return 'fields';
  if (clean === 'team') return 'members';
  if (clean === 'roles' || clean === 'api' || clean === 'webhooks')
    return 'security';
  if (clean === 'organization') return 'profile';
  if (clean === 'faq' || clean === 'knowledge_base') return 'kb';
  if (clean === 'booking' || clean === 'booking_form') return 'booking_form';
  if (isSection(clean)) return clean;
  if (isSection(raw)) return raw;
  return DEFAULT_SECTION;
}
