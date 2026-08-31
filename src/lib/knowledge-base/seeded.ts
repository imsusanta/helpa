import { INDUSTRY_REGISTRY } from '@/modules/registry';

export const COMPANY_HOURS_TITLE =
  'Where are you located and what are your business hours?';

const CUSTOM_SERVICE_PRICE = /^How much does .+ cost\?$/;
const CUSTOM_SERVICE_OFFER = /^Do you provide .+\?$/;

let cachedTitles: Set<string> | null = null;

export function collectSeededKnowledgeTitles(): Set<string> {
  if (cachedTitles) return cachedTitles;

  const titles = new Set<string>([COMPANY_HOURS_TITLE]);
  for (const industryModule of Object.values(INDUSTRY_REGISTRY)) {
    for (const template of industryModule.kbTemplates ?? []) {
      if (template.questionTitle) titles.add(template.questionTitle);
    }
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
