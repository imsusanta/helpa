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
import {
  getIndustryTerminology,
  resolveIndustryAlias,
} from '@/modules/terminology';

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

/**
 * Labels that aren't covered by the shared terminology registry (AI persona
 * names and knowledge-base framing). The `fields` label is always derived
 * from `src/modules/terminology.ts` so the contact noun has a single source
 * of truth.
 */
const INDUSTRY_LABEL_OVERRIDES: Record<
  string,
  Partial<Pick<IndustryLabels, 'deals' | 'ai' | 'kb'>>
> = {
  hospital_clinic: {
    deals: 'Currency & Billing',
    ai: 'AI Receptionist',
    kb: 'Hospital Info & FAQs',
  },
  coaching: {
    deals: 'Currency & Pricing',
    ai: 'AI Counselor',
    kb: 'Institute Info & FAQs',
  },
  real_estate: {
    deals: 'Currency & Pipeline',
    ai: 'AI Sales Assistant',
    kb: 'Property Info & FAQs',
  },
  travel: {
    deals: 'Currency & Rates',
    ai: 'AI Travel Assistant',
    kb: 'Travel Info & FAQs',
  },
  gym: {
    deals: 'Currency & Billing',
    ai: 'AI Fitness Assistant',
    kb: 'Gym Info & FAQs',
  },
  restaurant: {
    deals: 'Currency & Pricing',
    ai: 'AI Reservation Assistant',
    kb: 'Restaurant Info & FAQs',
  },
  solo_teacher: {
    deals: 'Currency & Tuition',
    ai: 'AI Teaching Assistant',
    kb: 'Course Info & FAQs',
  },
  salon: {
    deals: 'Currency & Services',
    ai: 'AI Salon Receptionist',
    kb: 'Salon Info & FAQs',
  },
};

function getLabels(industry: string | null | undefined): IndustryLabels {
  const canonical = resolveIndustryAlias(industry);
  const terminology = getIndustryTerminology(industry);
  const overrides = INDUSTRY_LABEL_OVERRIDES[canonical] ?? {};
  return {
    fields: `${terminology.contact} Custom Fields`,
    deals: overrides.deals ?? 'Currency Settings',
    ai: overrides.ai ?? 'AI Receptionist',
    kb: overrides.kb ?? 'Business Info & FAQs',
    reminders: 'Smart Reminders',
  };
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
  if (!allowed) return true; // No restriction — always visible
  return !!industry && allowed.includes(resolveIndustryAlias(industry));
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
