import {
  decideInformationResponse,
  factsFromKnowledgeItems,
  formatInformationDecisionForPrompt,
  type InformationDecision,
  type InformationEvidence,
  type RetrievedFact,
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
    return {
      retrievalFailed: true,
      retrievalErrorSource: 'database',
      failedSources: ['database'],
    };
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
    field:
      row.matchedPrice != null || row.package.starting_price != null
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

  const askedPrice = /\b(price|koto|কত|fee|rate|dam)\b/i.test(
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
    multipleMatches:
      result.matches.length > 1 && !result.requirements.destination,
  };
}

/**
 * Pull verified doctor/fee/timing rows out of the hospital context block.
 * A non-empty context blob is not itself a fact.
 */
export function factsFromHospitalContext(
  context: string,
  query: string
): RetrievedFact[] {
  if (!context?.trim()) return [];

  const facts: RetrievedFact[] = [];
  const doctorRe =
    /Dr\.\s+([^(\n]+)\s*\(([^)]+)\):\s*Fee:\s*₹\s*([0-9,]+)/gi;
  let match: RegExpExecArray | null;
  while ((match = doctorRe.exec(context)) !== null) {
    const name = match[1].trim();
    const dept = match[2].trim();
    const feeRaw = match[3].replace(/,/g, '');
    const fee = Number(feeRaw);
    if (!name || !Number.isFinite(fee) || fee <= 0) continue;
    facts.push({
      key: `${name}.fee`,
      value: `₹${Number(fee).toLocaleString('en-IN')}`,
      source: 'database',
      entity: name,
      field: 'fee',
    });
    facts.push({
      key: `${name}.department`,
      value: dept,
      source: 'database',
      entity: name,
      field: 'department',
    });
  }

  if (facts.length === 0) return [];

  const q = (query || '').toLowerCase();
  const mentioned = facts.filter((fact) => {
    const entity = (fact.entity || '').toLowerCase();
    return entity.length > 2 && q.includes(entity);
  });
  if (mentioned.length > 0) return mentioned;
  if (/\b(doctor|dr|fee|timing|department)\b/i.test(query) || /ফি|ডাক্তার/.test(query)) {
    return facts;
  }
  return [];
}

export function factsFromCoachingContext(
  context: string,
  query: string
): RetrievedFact[] {
  if (!context?.trim()) return [];
  const facts: RetrievedFact[] = [];
  const feeRe =
    /(?:course|batch|class)\s*[:\-]?\s*([^,\n]+).*?(?:fee|fees|price)\s*[:\-]?\s*₹?\s*([0-9,]+)/gi;
  let match: RegExpExecArray | null;
  while ((match = feeRe.exec(context)) !== null) {
    const name = match[1].trim();
    const fee = Number(match[2].replace(/,/g, ''));
    if (!name || !Number.isFinite(fee) || fee <= 0) continue;
    facts.push({
      key: `${name}.fee`,
      value: `₹${fee.toLocaleString('en-IN')}`,
      source: 'database',
      entity: name,
      field: 'fee',
    });
  }
  if (facts.length === 0) return [];
  const q = (query || '').toLowerCase();
  const mentioned = facts.filter(
    (fact) => fact.entity && q.includes(fact.entity.toLowerCase())
  );
  return mentioned.length > 0 ? mentioned : facts;
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
  const hospitalFacts = factsFromHospitalContext(
    input.hospitalContext || '',
    input.message
  );
  const coachingFacts = factsFromCoachingContext(
    input.coachingContext || '',
    input.message
  );

  const failedSources: Array<'database' | 'knowledge_base'> = [];
  if (travelEvidence.retrievalFailed) failedSources.push('database');
  if (input.knowledgeRetrievalFailed) failedSources.push('knowledge_base');

  const travelLookupSucceeded =
    input.travelResult != null && !input.travelResult.retrievalFailed;
  const databaseFacts = [
    ...(travelLookupSucceeded ? travelEvidence.databaseFacts || [] : []),
    ...hospitalFacts,
    ...coachingFacts,
  ];
  const hasStructuredDb =
    travelLookupSucceeded || databaseFacts.length > 0;

  return decideInformationResponse({
    message: input.message,
    industry: input.industry,
    handoffTriggers: { highValue: input.highValue },
    evidence: {
      ...travelEvidence,
      knowledgeBaseFacts: kbFacts,
      databaseFacts: hasStructuredDb ? databaseFacts : undefined,
      similarSuggestions: travelLookupSucceeded
        ? travelEvidence.similarSuggestions
        : undefined,
      failedSources,
      retrievalFailed:
        travelEvidence.retrievalFailed === true && databaseFacts.length === 0,
      retrievalErrorSource: travelEvidence.retrievalFailed
        ? 'database'
        : input.knowledgeRetrievalFailed && !hasStructuredDb
          ? 'knowledge_base'
          : undefined,
    },
  });
}

export function informationDecisionPromptBlock(
  decision: InformationDecision
): string {
  return `\n\n${formatInformationDecisionForPrompt(decision)}\n`;
}
