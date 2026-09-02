import { getIndustryModulePort } from '@/core/modules/industry-port';

export const COMPANY_HOURS_TITLE =
  'Where are you located and what are your business hours?';

const CUSTOM_SERVICE_PRICE = /^How much does .+ cost\?$/;
const CUSTOM_SERVICE_OFFER = /^Do you provide .+\?$/;

let cachedTitles: Set<string> | null = null;

export function collectSeededKnowledgeTitles(): Set<string> {
  if (cachedTitles) return cachedTitles;

  const titles = new Set<string>([COMPANY_HOURS_TITLE, 'Company Hours']);
  const portTitles = getIndustryModulePort().getSeededKnowledgeTitles?.() ?? [];
  for (const t of portTitles) {
    if (t) titles.add(t);
  }
  cachedTitles = titles;
  return titles;
}

/**
 * True when a KB row was created by workspace onboard / template seeding
 * rather than typed in by the tenant.
 */
export function isSeededKnowledgeTitle(title: string | null | undefined) {
  const value = String(title || '').trim();
  if (!value) return false;
  if (collectSeededKnowledgeTitles().has(value)) return true;
  return CUSTOM_SERVICE_PRICE.test(value) || CUSTOM_SERVICE_OFFER.test(value);
}
