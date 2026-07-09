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
  Database,
  CreditCard,
  Boxes,
  BellRing,
  type LucideIcon,
} from 'lucide-react';

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
  'templates',
  'fields',
  'deals',
  'members',
  'ai',
  'kb',
  'insurance',
  'reminders',
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
    deals: 'Appointment Settings',
    ai: 'AI Receptionist',
    kb: 'Hospital Information',
    reminders: 'Smart Reminders',
  },
  coaching: {
    fields: 'Student Custom Fields',
    deals: 'Admission Settings',
    ai: 'AI Counselor',
    kb: 'Institute Information',
    reminders: 'Smart Reminders',
  },
  real_estate: {
    fields: 'Lead Custom Fields',
    deals: 'Deal Pipeline Settings',
    ai: 'AI Sales Assistant',
    kb: 'Property Knowledge Base',
    reminders: 'Smart Reminders',
  },
  travel: {
    fields: 'Traveler Custom Fields',
    deals: 'Booking Settings',
    ai: 'AI Travel Assistant',
    kb: 'Travel Knowledge Base',
    reminders: 'Smart Reminders',
  },
  gym: {
    fields: 'Member Custom Fields',
    deals: 'Membership Settings',
    ai: 'AI Fitness Assistant',
    kb: 'Gym Knowledge Base',
    reminders: 'Smart Reminders',
  },
  restaurant: {
    fields: 'Guest Custom Fields',
    deals: 'Reservation Settings',
    ai: 'AI Reservation Assistant',
    kb: 'Restaurant Knowledge Base',
    reminders: 'Smart Reminders',
  },
};

const DEFAULT_LABELS: IndustryLabels = {
  fields: 'Contact Custom Fields',
  deals: 'Deal Settings',
  ai: 'AI Assistant',
  kb: 'Knowledge Base',
  reminders: 'Smart Reminders',
};

function getLabels(industry: string | null | undefined): IndustryLabels {
  if (!industry) return DEFAULT_LABELS;
  return INDUSTRY_LABELS[industry] || DEFAULT_LABELS;
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
  industry: string | null | undefined,
): boolean {
  const allowed = INDUSTRY_ONLY_SECTIONS[section];
  if (!allowed) return true; // No restriction — always visible
  return !!industry && allowed.includes(industry);
}

/**
 * Build the section metadata dynamically based on the active industry.
 */
export function getSectionMeta(
  industry: string | null | undefined,
): Record<SettingsSection, SectionMeta> {
  const labels = getLabels(industry);

  return {
    overview: { id: 'overview', label: 'Overview', icon: LayoutGrid, group: 'top' },
    profile: { id: 'profile', label: 'Your profile', icon: User, group: 'account' },
    security: { id: 'security', label: 'Login & security', icon: Shield, group: 'account' },
    appearance: { id: 'appearance', label: 'Appearance', icon: Palette, group: 'account' },
    billing: { id: 'billing', label: 'Billing & Plans', icon: CreditCard, group: 'account' },
    whatsapp: { id: 'whatsapp', label: 'WhatsApp', icon: PlugZap, group: 'workspace' },
    templates: { id: 'templates', label: 'Templates', icon: FileText, group: 'workspace' },
    fields: { id: 'fields', label: labels.fields, icon: Tags, group: 'workspace' },
    deals: { id: 'deals', label: labels.deals, icon: Coins, group: 'workspace' },
    members: { id: 'members', label: 'Team members', icon: UsersRound, group: 'workspace' },
    ai: { id: 'ai', label: labels.ai, icon: Brain, group: 'workspace' },
    kb: { id: 'kb', label: labels.kb, icon: Database, group: 'workspace' },
    insurance: { id: 'insurance', label: 'Health Insurance', icon: Shield, group: 'workspace' },
    reminders: { id: 'reminders', label: labels.reminders, icon: BellRing, group: 'workspace' },
  };
}

/** @deprecated Use getSectionMeta(industry) instead. Kept for backward compat. */
export const SECTION_META = getSectionMeta(null);

export const RAIL_GROUPS: { label: string | null; group: SectionMeta['group'] }[] = [
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
  if (raw === 'tags' || raw === 'custom-fields') return 'fields';
  if (isSection(raw)) return raw;
  return DEFAULT_SECTION;
}
