import { resolveIndustryAlias } from '../modules/terminology';
import { coachingAdapter } from './coaching.adapter';
import { generalAdapter } from './general.adapter';
import { healthcareAdapter } from './healthcare.adapter';
import type { IndustryAdapter } from './industry-adapter.interface';
import { travelAdapter } from './travel.adapter';

const REGISTRY: Record<string, IndustryAdapter> = {
  hospital_clinic: healthcareAdapter,
  coaching: coachingAdapter,
  travel: travelAdapter,
  general: generalAdapter,
};

/**
 * Resolves the appropriate IndustryAdapter for a given industry string or alias.
 * Falls back to GeneralAdapter for unknown or unsupported industries.
 */
export function getIndustryAdapter(industry?: string | null): IndustryAdapter {
  if (!industry) return generalAdapter;
  const canonical = resolveIndustryAlias(industry);
  return REGISTRY[canonical] || generalAdapter;
}

export { coachingAdapter, generalAdapter, healthcareAdapter, travelAdapter };
