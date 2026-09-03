import {
  decideInformationResponse,
  factsFromKnowledgeItems,
  formatInformationDecisionForPrompt,
  type InformationDecision,
  type InformationEvidence,
  type SimilarSuggestion,
} from '@/core/ai/information-policy';
import type { KnowledgeItem } from '@/core/knowledge';
import { formatMoney } from '@/lib/travel/matching';
import type { TourPackageMatchResult } from '@/lib/travel/types';

export function evidenceFromTravelResult(
  result: TourPackageMatchResult | null | undefined
): InformationEvidence {
  if (!result) return {};
  if (result.retrievalFailed) {
    return { retrievalFailed: true, retrievalErrorSource: 'database' };
  }

  const databaseFacts = result.matches.slice(0, 5).map((row) => ({
    key: `${row.package.name}.package`,
    value: [
      row.package.name,
      row.package.destination,
      row.matchedPrice != null
        ? formatMoney(row.matchedPrice, row.matchedCurrency || row.package.currency)
        : row.package.starting_price != null
          ? formatMoney(row.package.starting_price, row.package.currency)
          : 'price not listed',
    ]
      .filter(Boolean)
      .join(' · '),
    source: 'database' as const,
    entity: row.package.name,
    field: row.matchedPrice != null || row.package.starting_price != null
      ? 'price'
      : 'details',
  }));

  const similarSuggestions: SimilarSuggestion[] = (result.similarMatches || [])
    .slice(0, 3)
    .map((row) => ({
      label: row.package.name,
      destination: row.package.destination,
      price:
        formatMoney(
          row.matchedPrice,
          row.matchedCurrency || row.package.currency
        ) || undefined,
      detail: row.package.destination,
    }));

  const askedPrice = /\b(price|koto|কত|fee|rate)\b/i.test(
    result.requirements.query
  );
  const missingRequestedField =
    askedPrice &&
    result.matches.length > 0 &&
    result.matches.every(
      (row) => row.matchedPrice == null && row.package.starting_price == null
    );

  return {
    databaseFacts,
    similarSuggestions,
    missingRequestedField,
    multipleMatches: result.matches.length > 1 && !result.requirements.destination,
  };
}

export function decideWhatsAppInformation(input: {
  message: string;
  industry?: string | null;
  knowledgeItems?: KnowledgeItem[] | null;
  knowledgeRetrievalFailed?: boolean;
  travelResult?: TourPackageMatchResult | null;
  hospitalContext?: string;
  coachingContext?: string;
  highValue?: boolean;
}): InformationDecision {
  const travelEvidence = evidenceFromTravelResult(input.travelResult);
  const kbFacts = factsFromKnowledgeItems(
    input.knowledgeItems || [],
    input.message
  );
  const retrievalFailed = Boolean(
    input.knowledgeRetrievalFailed || travelEvidence.retrievalFailed
  );

  const hospitalLooksPresent =
    Boolean(input.hospitalContext && input.hospitalContext.trim()) &&
    /\b(doctor|fee|timing|₹|rs)\b/i.test(input.message);
  const coachingLooksPresent =
    Boolean(input.coachingContext && input.coachingContext.trim()) &&
    /\b(course|fee|batch|₹|rs)\b/i.test(input.message);

  return decideInformationResponse({
    message: input.message,
    industry: input.industry,
    handoffTriggers: { highValue: input.highValue },
    evidence: {
      ...travelEvidence,
      knowledgeBaseFacts: kbFacts,
      retrievalFailed,
      retrievalErrorSource: travelEvidence.retrievalFailed
        ? 'database'
        : input.knowledgeRetrievalFailed
          ? 'knowledge_base'
          : undefined,
      databaseFacts: [
        ...(travelEvidence.databaseFacts || []),
        ...(hospitalLooksPresent
          ? [
              {
                key: 'hospital.context',
                value: 'hospital context present',
                source: 'database' as const,
                field: 'context',
              },
            ]
          : []),
        ...(coachingLooksPresent
          ? [
              {
                key: 'coaching.context',
                value: 'coaching context present',
                source: 'database' as const,
                field: 'context',
              },
            ]
          : []),
      ],
    },
  });
}

export function informationDecisionPromptBlock(
  decision: InformationDecision
): string {
  return `\n\n${formatInformationDecisionForPrompt(decision)}\n`;
}
