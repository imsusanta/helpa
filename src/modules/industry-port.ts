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
import { evidenceFromTravelResult } from '@/lib/whatsapp/ai-information';
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

export const modulesIndustryPort: IndustryModulePort = {
  getIndustryModule: (industry) => toCoreManifest(industry),
  resolveSystemPrompt: (industry, customPrompt) =>
    resolveSystemPrompt(industry, customPrompt),
  gatherAnswerEvidence: async ({ industry, accountId, userMessage }) => {
    if (resolveIndustryAlias(industry) !== 'travel') return {};
    return gatherTravelEvidence(accountId, userMessage);
  },
  augmentSystemPrompt: async ({
    industry,
    accountId,
    userMessage,
    systemPrompt,
  }) => {
    if (resolveIndustryAlias(industry) !== 'travel') return systemPrompt;
    const evidence = await gatherTravelEvidence(accountId, userMessage);
    return systemPrompt + (evidence.promptSuffix || '');
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
