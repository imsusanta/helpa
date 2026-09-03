/**
 * Industry Module Port implementation — modules layer adapter.
 *
 * Registers the registry-backed implementation into the Core industry port
 * (`src/core/modules/industry-port.ts`). This is the ONLY place where the
 * modules layer meets the platform layers: `src/instrumentation.ts` (server
 * boot) and `src/tests/setup.ts` (test bootstrap) import this module for its
 * registration side effect.
 */

import {
  setIndustryModulePort,
  type CoreIndustryManifest,
  type IndustryAnswerEvidence,
  type IndustryModulePort,
} from '@/core/modules/industry-port';
import { getAdminClient } from '@/lib/db/server';
import { matchTourPackagesForMessage } from '@/lib/travel/retrieval';
import { buildTravelPackagePromptBlock } from '@/lib/travel/prompt';
import {
  evidenceFromCoachingCourses,
  evidenceFromHospitalDoctors,
  evidenceFromTravelResult,
  type CoachingCourseRow,
  type HospitalDoctorRow,
} from '@/lib/whatsapp/ai-information';
import {
  formatCoachingCourses,
  formatDoctors,
} from '@/lib/whatsapp/ai-context';
import {
  getIndustryModule,
  resolveSystemPrompt,
  INDUSTRY_REGISTRY,
} from './registry';
import { resolveIndustryAlias } from './terminology';

function toCoreManifest(industry?: string | null): CoreIndustryManifest {
  const industryModule = getIndustryModule(industry);
  return {
    id: industryModule.id,
    name: industryModule.name,
    aiRole: industryModule.aiRole,
    systemPrompt: industryModule.systemPrompt,
    terminology: industryModule.terminology as
      Record<string, string> | undefined,
    safetyKeywords: industryModule.safetyKeywords,
    safetyResponse: industryModule.safetyResponse,
    entityLabel: industryModule.entityConfigs?.contacts?.label,
  };
}

async function gatherTravelEvidence(
  accountId: string,
  userMessage: string
): Promise<IndustryAnswerEvidence> {
  const packageResult = await matchTourPackagesForMessage(
    getAdminClient(),
    accountId,
    userMessage
  );
  const evidence = evidenceFromTravelResult(packageResult);
  return {
    promptSuffix: buildTravelPackagePromptBlock(packageResult),
    retrievalFailed: packageResult.retrievalFailed,
    missingRequestedField: evidence.missingRequestedField,
    multipleMatches: evidence.multipleMatches,
    facts: evidence.databaseFacts?.map((fact) => ({
      key: fact.key,
      value: fact.value,
      source: 'database' as const,
      entity: fact.entity,
      field: fact.field,
    })),
    similar: evidence.similarSuggestions,
  };
}

function toPortFacts(
  facts: ReturnType<typeof evidenceFromHospitalDoctors>['databaseFacts']
): IndustryAnswerEvidence['facts'] {
  return facts?.map((fact) => ({
    key: fact.key,
    value: fact.value,
    source: 'database' as const,
    entity: fact.entity,
    field: fact.field,
  }));
}

async function gatherHospitalEvidence(
  accountId: string,
  userMessage: string
): Promise<IndustryAnswerEvidence> {
  const { data, error } = await getAdminClient()
    .from('hospital_doctors')
    .select(
      'name, department, specialization, consultation_fee, fee, available_days, working_hours'
    )
    .eq('account_id', accountId)
    .eq('status', 'active');
  if (error) return { retrievalFailed: true };
  const doctors = (data || []) as HospitalDoctorRow[];
  const evidence = evidenceFromHospitalDoctors(doctors, userMessage);
  return {
    promptSuffix: doctors.length
      ? `\n\n${formatDoctors(doctors as Parameters<typeof formatDoctors>[0])}`
      : '',
    retrievalFailed: false,
    missingRequestedField: evidence.missingRequestedField,
    multipleMatches: evidence.multipleMatches,
    facts: toPortFacts(evidence.databaseFacts),
  };
}

async function gatherCoachingEvidence(
  accountId: string,
  userMessage: string
): Promise<IndustryAnswerEvidence> {
  const { data, error } = await getAdminClient()
    .from('coaching_courses')
    .select('name, fee, duration')
    .eq('account_id', accountId);
  if (error) return { retrievalFailed: true };
  const courses = (data || []) as CoachingCourseRow[];
  const evidence = evidenceFromCoachingCourses(courses, userMessage);
  return {
    promptSuffix: courses.length ? `\n\n${formatCoachingCourses(courses)}` : '',
    retrievalFailed: false,
    missingRequestedField: evidence.missingRequestedField,
    multipleMatches: evidence.multipleMatches,
    facts: toPortFacts(evidence.databaseFacts),
  };
}

export const modulesIndustryPort: IndustryModulePort = {
  getIndustryModule: (industry) => toCoreManifest(industry),
  resolveSystemPrompt: (industry, customPrompt) =>
    resolveSystemPrompt(industry, customPrompt),
  gatherAnswerEvidence: async ({ industry, accountId, userMessage }) => {
    const alias = resolveIndustryAlias(industry);
    if (alias === 'travel') return gatherTravelEvidence(accountId, userMessage);
    if (alias === 'hospital_clinic') {
      return gatherHospitalEvidence(accountId, userMessage);
    }
    if (alias === 'coaching' || alias === 'solo_teacher') {
      return gatherCoachingEvidence(accountId, userMessage);
    }
    return {};
  },
  augmentSystemPrompt: async ({
    industry,
    accountId,
    userMessage,
    systemPrompt,
  }) => {
    const alias = resolveIndustryAlias(industry);
    if (alias === 'travel') {
      const evidence = await gatherTravelEvidence(accountId, userMessage);
      return systemPrompt + (evidence.promptSuffix || '');
    }
    if (alias === 'hospital_clinic') {
      const evidence = await gatherHospitalEvidence(accountId, userMessage);
      return systemPrompt + (evidence.promptSuffix || '');
    }
    if (alias === 'coaching' || alias === 'solo_teacher') {
      const evidence = await gatherCoachingEvidence(accountId, userMessage);
      return systemPrompt + (evidence.promptSuffix || '');
    }
    return systemPrompt;
  },
  getSeededKnowledgeTitles: () => {
    const titles = new Set<string>();
    for (const industryModule of Object.values(INDUSTRY_REGISTRY)) {
      for (const template of industryModule.kbTemplates ?? []) {
        if (template.questionTitle) titles.add(template.questionTitle);
      }
    }
    return titles;
  },
};

export function registerIndustryModulePort(): void {
  // Idempotent: re-registering the same adapter is a no-op in effect.
  setIndustryModulePort(modulesIndustryPort);
}

// Register on import so a single import of this module is sufficient.
registerIndustryModulePort();
