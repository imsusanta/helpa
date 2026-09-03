import {
  decideInformationResponse,
  factsFromBusinessConfiguration,
  factsFromKnowledgeItems,
  factsFromStaffConversation,
  formatInformationDecisionForPrompt,
  type InformationDecision,
  type InformationEvidence,
  type RetrievedFact,
  type SimilarSuggestion,
} from '@/core/ai/information-policy';
import type { KnowledgeItem } from '@/core/knowledge';
import { formatMoney } from '@/lib/travel/matching';
import type { TourPackageMatchResult } from '@/lib/travel/types';

export interface HospitalDoctorRow {
  name: string;
  department?: string | null;
  specialization?: string | null;
  consultation_fee?: number | string | null;
  fee?: number | string | null;
  available_days?: string[] | null;
  working_hours?: unknown;
}

export interface CoachingCourseRow {
  name: string;
  fee?: number | string | null;
  duration?: string | null;
}

function parsePositiveFee(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/,/g, ''));
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
}

function queryMentionsEntity(query: string, entity: string): boolean {
  const q = (query || '').toLowerCase();
  const name = entity.toLowerCase().replace(/^dr\.?\s+/i, '').trim();
  return name.length > 2 && q.includes(name);
}

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

export function factsFromHospitalDoctors(
  doctors: HospitalDoctorRow[] | undefined,
  query: string
): RetrievedFact[] {
  if (!doctors?.length) return [];
  const facts: RetrievedFact[] = [];
  for (const doctor of doctors) {
    const name = (doctor.name || '').replace(/^Dr\.\s+/i, '').trim();
    if (!name) continue;
    const fee = parsePositiveFee(doctor.consultation_fee ?? doctor.fee);
    if (fee) {
      facts.push({
        key: `${name}.fee`,
        value: `₹${fee.toLocaleString('en-IN')}`,
        source: 'database',
        entity: name,
        field: 'fee',
      });
    }
    if (doctor.department) {
      facts.push({
        key: `${name}.department`,
        value: String(doctor.department),
        source: 'database',
        entity: name,
        field: 'department',
      });
    }
    const hours = doctor.working_hours as
      | { start?: string; end?: string }
      | null
      | undefined;
    if (hours?.start && hours?.end) {
      facts.push({
        key: `${name}.hours`,
        value: `${hours.start}–${hours.end}`,
        source: 'database',
        entity: name,
        field: 'hours',
      });
    }
  }
  if (facts.length === 0) return [];
  const mentioned = facts.filter(
    (fact) => fact.entity && queryMentionsEntity(query, fact.entity)
  );
  if (mentioned.length > 0) return mentioned;
  if (
    /\b(doctor|dr|fee|timing|department)\b/i.test(query) ||
    /ফি|ডাক্তার/.test(query)
  ) {
    return facts;
  }
  return [];
}

export function evidenceFromHospitalDoctors(
  doctors: HospitalDoctorRow[] | undefined,
  query: string,
  lookupFailed?: boolean
): InformationEvidence {
  if (lookupFailed) {
    return {
      retrievalFailed: true,
      retrievalErrorSource: 'database',
      failedSources: ['database'],
    };
  }
  if (doctors === undefined) return {};
  const facts = factsFromHospitalDoctors(doctors, query);
  const askedFee = /\b(fee|fees|price|koto|কত|dam)\b/i.test(query);
  const mentioned = (doctors || []).filter((doctor) =>
    queryMentionsEntity(query, doctor.name || '')
  );
  const pool = mentioned.length > 0 ? mentioned : doctors;
  const missingRequestedField =
    askedFee &&
    pool.length > 0 &&
    pool.every(
      (doctor) => parsePositiveFee(doctor.consultation_fee ?? doctor.fee) == null
    );
  return {
    databaseFacts: facts,
    missingRequestedField,
    multipleMatches:
      askedFee &&
      mentioned.length === 0 &&
      doctors.length > 1 &&
      /\b(doctor|dr|fee)\b/i.test(query),
  };
}

export function factsFromCoachingCourses(
  courses: CoachingCourseRow[] | undefined,
  query: string
): RetrievedFact[] {
  if (!courses?.length) return [];
  const facts: RetrievedFact[] = [];
  for (const course of courses) {
    const name = (course.name || '').trim();
    if (!name) continue;
    const fee = parsePositiveFee(course.fee);
    if (fee) {
      facts.push({
        key: `${name}.fee`,
        value: `₹${fee.toLocaleString('en-IN')}`,
        source: 'database',
        entity: name,
        field: 'fee',
      });
    }
    if (course.duration) {
      facts.push({
        key: `${name}.duration`,
        value: String(course.duration),
        source: 'database',
        entity: name,
        field: 'duration',
      });
    }
  }
  if (facts.length === 0) return [];
  const mentioned = facts.filter(
    (fact) => fact.entity && queryMentionsEntity(query, fact.entity)
  );
  if (mentioned.length > 0) return mentioned;
  if (/\b(course|batch|fee|class|admission)\b/i.test(query) || /কোর্স|ব্যাচ/.test(query)) {
    return facts;
  }
  return [];
}

export function evidenceFromCoachingCourses(
  courses: CoachingCourseRow[] | undefined,
  query: string,
  lookupFailed?: boolean
): InformationEvidence {
  if (lookupFailed) {
    return {
      retrievalFailed: true,
      retrievalErrorSource: 'database',
      failedSources: ['database'],
    };
  }
  if (courses === undefined) return {};
  const facts = factsFromCoachingCourses(courses, query);
  const askedFee = /\b(fee|fees|price|koto|কত|dam)\b/i.test(query);
  const mentioned = (courses || []).filter((course) =>
    queryMentionsEntity(query, course.name || '')
  );
  const pool = mentioned.length > 0 ? mentioned : courses;
  return {
    databaseFacts: facts,
    missingRequestedField:
      askedFee &&
      pool.length > 0 &&
      pool.every((course) => parsePositiveFee(course.fee) == null),
    multipleMatches:
      askedFee &&
      mentioned.length === 0 &&
      courses.length > 1 &&
      /\b(course|batch|class|admission)\b/i.test(query),
  };
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
  hospitalDoctors?: HospitalDoctorRow[];
  coachingCourses?: CoachingCourseRow[];
  hospitalLookupFailed?: boolean;
  coachingLookupFailed?: boolean;
  conversationMessages?: Array<{
    sender_type?: string | null;
    content_text?: string | null;
  }>;
  businessName?: string | null;
  welcomeMessage?: string | null;
  highValue?: boolean;
}): InformationDecision {
  const travelEvidence = evidenceFromTravelResult(input.travelResult);
  const kbFacts = factsFromKnowledgeItems(
    input.knowledgeItems || [],
    input.message
  );
  const hospitalStructured = evidenceFromHospitalDoctors(
    input.hospitalDoctors,
    input.message,
    input.hospitalLookupFailed
  );
  const coachingStructured = evidenceFromCoachingCourses(
    input.coachingCourses,
    input.message,
    input.coachingLookupFailed
  );
  const hospitalFacts =
    input.hospitalDoctors !== undefined || input.hospitalLookupFailed
      ? hospitalStructured.databaseFacts || []
      : factsFromHospitalContext(input.hospitalContext || '', input.message);
  const coachingFacts =
    input.coachingCourses !== undefined || input.coachingLookupFailed
      ? coachingStructured.databaseFacts || []
      : factsFromCoachingContext(input.coachingContext || '', input.message);

  const failedSources: Array<'database' | 'knowledge_base'> = [];
  if (travelEvidence.retrievalFailed) failedSources.push('database');
  if (input.hospitalLookupFailed || input.coachingLookupFailed) {
    if (!failedSources.includes('database')) failedSources.push('database');
  }
  if (input.knowledgeRetrievalFailed) failedSources.push('knowledge_base');

  const travelLookupSucceeded =
    input.travelResult != null && !input.travelResult.retrievalFailed;
  const hospitalLookupSucceeded =
    input.hospitalDoctors !== undefined && !input.hospitalLookupFailed;
  const coachingLookupSucceeded =
    input.coachingCourses !== undefined && !input.coachingLookupFailed;
  const databaseFacts = [
    ...(travelLookupSucceeded ? travelEvidence.databaseFacts || [] : []),
    ...hospitalFacts,
    ...coachingFacts,
  ];
  const coachingCatalogRelevant =
    coachingFacts.length > 0 ||
    (coachingLookupSucceeded &&
      /\b(course|batch|class|admission)\b/i.test(input.message));
  const hospitalCatalogRelevant =
    hospitalFacts.length > 0 ||
    (hospitalLookupSucceeded &&
      (/\b(doctor|dr|fee|timing|department)\b/i.test(input.message) ||
        /ফি|ডাক্তার/.test(input.message)));
  const hasStructuredDb =
    travelLookupSucceeded ||
    hospitalCatalogRelevant ||
    coachingCatalogRelevant ||
    databaseFacts.length > 0;
  const industryDbFailed =
    travelEvidence.retrievalFailed === true ||
    input.hospitalLookupFailed === true ||
    input.coachingLookupFailed === true;

  return decideInformationResponse({
    message: input.message,
    industry: input.industry,
    handoffTriggers: { highValue: input.highValue },
    evidence: {
      ...travelEvidence,
      knowledgeBaseFacts: kbFacts,
      configurationFacts: factsFromBusinessConfiguration({
        businessName: input.businessName,
        welcomeMessage: input.welcomeMessage,
        query: input.message,
      }),
      conversationFacts: factsFromStaffConversation(
        input.conversationMessages || [],
        input.message
      ),
      databaseFacts: hasStructuredDb ? databaseFacts : undefined,
      similarSuggestions: travelLookupSucceeded
        ? travelEvidence.similarSuggestions
        : undefined,
      missingRequestedField:
        hospitalStructured.missingRequestedField === true ||
        coachingStructured.missingRequestedField === true ||
        travelEvidence.missingRequestedField === true,
      multipleMatches:
        hospitalStructured.multipleMatches === true ||
        coachingStructured.multipleMatches === true ||
        travelEvidence.multipleMatches === true,
      failedSources,
      retrievalFailed: industryDbFailed && databaseFacts.length === 0,
      retrievalErrorSource: industryDbFailed
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
