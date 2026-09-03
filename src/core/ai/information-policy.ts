/**
 * Helpa AI — production information-availability policy.
 *
 * Deterministic decision layer that runs before (and after) the LLM:
 * classify the question, search authorized sources, resolve conflicts,
 * and choose a client-safe outcome when information is missing.
 *
 * Customer-facing replies never expose these internals.
 */

import { resolveIndustryAlias } from '@/core/modules/terminology';

export const INFORMATION_POLICY_MARKER = '[MANDATORY INFORMATION AVAILABILITY POLICY]';

export type QuestionType = 'business' | 'customer' | 'general' | 'action';

export type AnswerSource =
  | 'database'
  | 'knowledge_base'
  | 'conversation'
  | 'configuration'
  | 'general_knowledge'
  | 'none';

export type AnswerConfidence = 'high' | 'medium' | 'low';

export type InformationOutcome =
  | 'direct_answer'
  | 'clarification'
  | 'similar_suggestion'
  | 'safe_fallback'
  | 'system_error'
  | 'general_knowledge';

export type ReplyLanguage = 'bn' | 'en';

export type IndustryPolicyFamily =
  | 'travel'
  | 'hospital'
  | 'coaching'
  | 'generic';

export interface RetrievedFact {
  /** Stable key used for conflict resolution, e.g. "platinum.price". */
  key: string;
  value: string;
  source: Exclude<AnswerSource, 'none' | 'general_knowledge'>;
  field?: string;
  entity?: string;
}

export interface SimilarSuggestion {
  label: string;
  detail?: string;
  destination?: string;
  price?: string;
}

export interface InformationEvidence {
  databaseFacts?: RetrievedFact[];
  knowledgeBaseFacts?: RetrievedFact[];
  conversationFacts?: RetrievedFact[];
  configurationFacts?: RetrievedFact[];
  similarSuggestions?: SimilarSuggestion[];
  retrievalFailed?: boolean;
  retrievalErrorSource?: 'database' | 'knowledge_base' | 'search';
  /** Source-specific failures. A KB outage must not hide a successful DB match. */
  failedSources?: Array<'database' | 'knowledge_base' | 'search'>;
  /** True when the asked entity exists but a required field (e.g. price) is missing. */
  missingRequestedField?: boolean;
  /** True when several entities match and the customer has not picked one. */
  multipleMatches?: boolean;
}

export interface HandoffTriggers {
  complaint?: boolean;
  humanRequested?: boolean;
  highValue?: boolean;
  bookingPaymentIssue?: boolean;
  sensitive?: boolean;
}

export interface InformationDecision {
  questionType: QuestionType;
  outcome: InformationOutcome;
  answerSource: AnswerSource;
  answerConfidence: AnswerConfidence;
  handoffRequired: boolean;
  handoffReason?: string;
  resolvedFacts: RetrievedFact[];
  similarSuggestions: SimilarSuggestion[];
  clarificationPrompt?: string;
  fallbackMessage?: string;
  allowGeneralKnowledge: boolean;
  industryFamily: IndustryPolicyFamily;
  language: ReplyLanguage;
}

export interface AnswerMetadata {
  answer_source: AnswerSource;
  answer_confidence: AnswerConfidence;
  handoff_required: boolean;
  question_type: QuestionType;
  outcome: InformationOutcome;
}

export const SOURCE_PRIORITY: Record<
  Exclude<AnswerSource, 'none' | 'general_knowledge'>,
  number
> = {
  database: 0,
  knowledge_base: 1,
  configuration: 2,
  conversation: 3,
};

function hasAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

const BUSINESS_OWNERSHIP_RE = [
  /\b(your|yours|our|ours|you\s+guys|this\s+(?:agency|clinic|hospital|institute|academy|business|company)|apnader|apnar)\b/i,
  /আপনা(?:দের|র)/,
  /আমাদের/,
];

const PRICE_FIELD_RE = [
  /\b(price|pricing|rate|fee|fees|cost|charge|charges|koto|kota|dam|taka|rs\.?|inr)\b/i,
  /₹/,
  /খরচ|দাম|ফি|টাকা|কত/,
];

const PRICE_IN_TEXT_RE =
  /(?:₹|rs\.?|inr|taka)\s*[\d,]+|\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\b|\b\d{4,7}\b/i;

function queryMentions(query: string, entity: string): boolean {
  const q = (query || '').toLowerCase();
  const name = (entity || '')
    .toLowerCase()
    .replace(/^dr\.?\s+/i, '')
    .trim();
  return name.length > 2 && q.includes(name);
}

const PACKAGE_ENTITY_RE = [
  /\b(package|packages|tour|trip|itinerary|card|plan|hotel)\b/i,
  /প্যাকেজ/,
];

const HOSPITAL_ENTITY_RE = [
  /\b(doctor|dr\.?|physician|consultant|department|opd|appointment|slot|clinic|timing|timings|fee|report|token)\b/i,
];

const COACHING_ENTITY_RE = [
  /\b(course|courses|batch|batches|admission|fee|fees|class|classes|tuition|card|plan)\b/i,
  /কোর্স|ব্যাচ/,
];

const ACTION_RE = [
  /\b(book|booking|pay|payment|cancel|reschedule|complain|complaint|refund|speak\s+to|talk\s+to|human|agent|staff|handoff|confirm\s+booking)\b/i,
  /বুক|পেমেন্ট|অভিযোগ/,
];

const CUSTOMER_RECORD_RE = [
  /\bmy\s+(?:booking|appointment|report|bill|order)(?:\s+status)?\b/i,
  /আমার\s+(?:booking|appointment|report|পেমেন্ট)/,
];

const COMPLAINT_RE = [
  /\b(complain|complaint|refund|scam|fraud|angry|worst|terrible)\b/i,
  /অভিযোগ|রিফান্ড/,
];

const HUMAN_REQUEST_RE = [
  /\b(speak\s+to\s+(?:a\s+)?(?:human|agent|person|staff)|talk\s+to\s+(?:a\s+)?(?:human|agent|person|staff)|real\s+person|human\s+please|agent\s+dao)\b/i,
  /মানুষ(?:ের)?\s+সাথে|স্টাফ/,
];

const PAYMENT_ISSUE_RE = [
  /\b(payment\s+(?:fail|failed|issue|problem)|paid\s+but|double\s+charge|not\s+received)\b/i,
  /পেমেন্ট\s+(?:হয়নি|সমস্যা)/,
];

const SENSITIVE_RE = [/\b(legal|lawsuit|police|abuse|harass|suicide|self[\s-]?harm)\b/i];

const GENERAL_TRAVEL_RE = [
  /\b(best\s+time|when\s+to\s+(?:go|visit)|weather|season|how\s+to\s+(?:reach|go)|what\s+to\s+(?:wear|pack|see)|tips?)\b/i,
  /কখন\s+ভালো|কোন\s+সময়|আবহাওয়া/,
];

const BUSINESS_FACT_RE = [
  /\b(price|pricing|rate|fee|fees|cost|package|packages|availability|available|itinerary|inclusion|exclusion|departure|doctor|appointment|course|batch|admission|timing|timings|hours|policy|policies|hotel)\b/i,
  /কত|দাম|ফি|প্যাকেজ/,
];

const AMBIGUOUS_ENTITY_RE = [
  /\b(package|tour|trip|course|doctor|plan|card|hotel)\b/i,
  /প্যাকেজ|কোর্স/,
];

export function detectReplyLanguage(text: string): ReplyLanguage {
  if (/[\u0980-\u09FF]/.test(text)) return 'bn';
  if (/\b(koto|kota|ache|chai|hobe|dam|apnader|apnar|taka)\b/i.test(text)) {
    return 'bn';
  }
  return 'en';
}

export function resolveIndustryPolicyFamily(
  industry: string | null | undefined
): IndustryPolicyFamily {
  const alias = resolveIndustryAlias(industry);
  if (alias === 'travel') return 'travel';
  if (alias === 'hospital_clinic') return 'hospital';
  if (alias === 'coaching' || alias === 'solo_teacher') return 'coaching';
  return 'generic';
}

export function classifyQuestion(
  text: string,
  industry?: string | null
): QuestionType {
  const family = resolveIndustryPolicyFamily(industry);
  const trimmed = (text || '').trim();
  if (!trimmed) return 'general';

  if (hasAny(trimmed, HUMAN_REQUEST_RE) || hasAny(trimmed, ACTION_RE)) {
    if (hasAny(trimmed, CUSTOMER_RECORD_RE) && !hasAny(trimmed, BUSINESS_FACT_RE)) {
      return 'customer';
    }
    if (
      /\b(book|booking|pay|payment|cancel|reschedule|complain|complaint|refund|confirm)\b/i.test(
        trimmed
      ) ||
      /বুক|পেমেন্ট|অভিযোগ/.test(trimmed)
    ) {
      return 'action';
    }
  }

  if (hasAny(trimmed, CUSTOMER_RECORD_RE)) return 'customer';

  const ownedBusinessAsk =
    hasAny(trimmed, BUSINESS_OWNERSHIP_RE) &&
    (hasAny(trimmed, BUSINESS_FACT_RE) ||
      hasAny(trimmed, PACKAGE_ENTITY_RE) ||
      hasAny(trimmed, HOSPITAL_ENTITY_RE) ||
      hasAny(trimmed, COACHING_ENTITY_RE));

  if (ownedBusinessAsk) return 'business';

  if (family === 'travel' && hasAny(trimmed, PACKAGE_ENTITY_RE)) {
    if (hasAny(trimmed, GENERAL_TRAVEL_RE) && !hasAny(trimmed, PRICE_FIELD_RE)) {
      return 'general';
    }
    return 'business';
  }

  if (family === 'hospital' && hasAny(trimmed, HOSPITAL_ENTITY_RE)) {
    return 'business';
  }

  if (family === 'coaching' && hasAny(trimmed, COACHING_ENTITY_RE)) {
    return 'business';
  }

  if (hasAny(trimmed, PRICE_FIELD_RE) && hasAny(trimmed, AMBIGUOUS_ENTITY_RE)) {
    return 'business';
  }

  if (
    hasAny(trimmed, PRICE_FIELD_RE) &&
    (family === 'travel' || family === 'hospital' || family === 'coaching') &&
    !hasAny(trimmed, GENERAL_TRAVEL_RE)
  ) {
    return 'business';
  }

  if (hasAny(trimmed, GENERAL_TRAVEL_RE) && !hasAny(trimmed, BUSINESS_OWNERSHIP_RE)) {
    return 'general';
  }

  if (hasAny(trimmed, BUSINESS_FACT_RE) && hasAny(trimmed, BUSINESS_OWNERSHIP_RE)) {
    return 'business';
  }

  return 'general';
}

function normalizeFactKey(fact: RetrievedFact): string {
  const entity = (fact.entity || fact.key.split('.')[0] || '')
    .toLowerCase()
    .replace(/\b(package|card|plan|tour|trip|course|batch)\b/g, '')
    .replace(/[^a-z0-9\u0980-\u09FF]+/g, ' ')
    .trim();
  const field = (fact.field || fact.key.split('.')[1] || 'value')
    .toLowerCase()
    .trim();
  return `${entity || fact.key.toLowerCase()}.${field}`;
}

/**
 * Real-time DB > Knowledge Base > static configuration > conversation.
 * Conversation never overrides a business price/schedule from DB or KB.
 */
export function resolveAuthoritativeFacts(
  evidence: InformationEvidence
): RetrievedFact[] {
  const buckets: RetrievedFact[] = [
    ...(evidence.databaseFacts || []),
    ...(evidence.knowledgeBaseFacts || []),
    ...(evidence.configurationFacts || []),
    ...(evidence.conversationFacts || []),
  ];

  const winners = new Map<string, RetrievedFact>();
  for (const fact of buckets) {
    const key = normalizeFactKey(fact);
    const existing = winners.get(key);
    if (!existing) {
      winners.set(key, fact);
      continue;
    }
    if (SOURCE_PRIORITY[fact.source] < SOURCE_PRIORITY[existing.source]) {
      winners.set(key, fact);
    }
  }
  return Array.from(winners.values());
}

export function detectHandoffTriggers(
  message: string,
  extras?: HandoffTriggers
): Required<HandoffTriggers> {
  return {
    complaint: Boolean(extras?.complaint || hasAny(message, COMPLAINT_RE)),
    humanRequested: Boolean(
      extras?.humanRequested || hasAny(message, HUMAN_REQUEST_RE)
    ),
    highValue: Boolean(extras?.highValue),
    bookingPaymentIssue: Boolean(
      extras?.bookingPaymentIssue || hasAny(message, PAYMENT_ISSUE_RE)
    ),
    sensitive: Boolean(extras?.sensitive || hasAny(message, SENSITIVE_RE)),
  };
}

export function isAmbiguousBusinessAsk(message: string): boolean {
  const hasEntity = hasAny(message, AMBIGUOUS_ENTITY_RE);
  if (!hasEntity) return false;
  const asksSpecificField =
    hasAny(message, PRICE_FIELD_RE) ||
    /\b(itinerary|inclusion|exclusion|availability|available|detail|details|timing|timings|schedule|batch|doctor|fee)\b/i.test(
      message
    );
  return !asksSpecificField;
}

function fallbackCopy(
  family: IndustryPolicyFamily,
  kind: 'no_data' | 'system_error' | 'no_match' | 'missing_price',
  language: ReplyLanguage
): string {
  if (language === 'bn') {
    if (kind === 'system_error') {
      return 'এই মুহূর্তে informationটি verify করতে পারছি না। আমাদের team confirm করে দিতে পারবে।';
    }
    if (kind === 'missing_price') {
      return 'এই package-এর price বর্তমানে verifiedভাবে available নেই। চাইলে আমাদের team থেকে confirm করে দিতে পারি।';
    }
    if (kind === 'no_match' && family === 'travel') {
      return 'আপনার requirements-এর সঙ্গে matching package বর্তমানে পাওয়া যাচ্ছে না। চাইলে আমাদের team-এর সঙ্গে কথা বলে custom option দেখতে পারেন।';
    }
    if (family === 'hospital') {
      return 'এই doctor/fee/timing-এর verified information এখন available নেই। চাইলে আমাদের team confirm করে দিতে পারবে।';
    }
    if (family === 'coaching') {
      return 'এই course/fee/batch-এর verified information এখন available নেই। চাইলে আমাদের team confirm করে দিতে পারবে।';
    }
    return 'এই informationটি verifiedভাবে available নেই। চাইলে আমাদের team থেকে confirm করে দিতে পারি।';
  }

  if (kind === 'system_error') {
    return 'I cannot verify this information right now. Our team can confirm it for you.';
  }
  if (kind === 'missing_price') {
    return 'This package price is not currently available from a verified source. I can have our team confirm it.';
  }
  if (kind === 'no_match' && family === 'travel') {
    return 'No matching package is currently available for your requirements. You can talk with our team about a custom option.';
  }
  if (family === 'hospital') {
    return 'Verified doctor, fee, or timing details are not available right now. Our team can confirm them for you.';
  }
  if (family === 'coaching') {
    return 'Verified course, fee, or batch details are not available right now. Our team can confirm them for you.';
  }
  return 'This information is not currently available from a verified source. I can have our team confirm it.';
}

function clarificationCopy(
  message: string,
  family: IndustryPolicyFamily,
  language: ReplyLanguage
): string {
  const entity =
    message.match(
      /\b([A-Za-z][A-Za-z]+)(?:\s+(?:package|tour|trip|card|plan|course|প্যাকেজ))\b/i
    )?.[1] || (family === 'travel' ? 'package' : 'service');

  if (language === 'bn') {
    if (family === 'travel') {
      return `আপনি ${entity} package-এর price জানতে চাইছেন, নাকি complete package details?`;
    }
    if (family === 'hospital') {
      return 'আপনি doctor-এর fee জানতে চাইছেন, নাকি timing ও appointment details?';
    }
    if (family === 'coaching') {
      return 'আপনি course-এর fee জানতে চাইছেন, নাকি batch ও timing details?';
    }
    return 'আপনি price জানতে চাইছেন, নাকি complete details?';
  }

  if (family === 'travel') {
    return `Are you asking for the ${entity} package price, or the complete package details?`;
  }
  if (family === 'hospital') {
    return 'Are you asking for the consultation fee, or doctor timings and appointment details?';
  }
  if (family === 'coaching') {
    return 'Are you asking for the course fee, or batch and timing details?';
  }
  return 'Are you asking for the price, or the complete details?';
}

function similarSuggestionCopy(
  suggestions: SimilarSuggestion[],
  message: string,
  language: ReplyLanguage
): string {
  const asked =
    message.match(
      /\b([A-Za-z][A-Za-z]+)(?:\s+(?:package|tour|trip|প্যাকেজ))\b/i
    )?.[1] || 'that destination';
  const options = suggestions
    .map((row) =>
      [row.destination || row.label, row.price].filter(Boolean).join(' ')
    )
    .filter(Boolean)
    .join(', ');

  if (language === 'bn') {
    return `${asked}-এর matching package এখন নেই। তবে verified options আছে: ${options}। চাইলে details বলে দিতে পারি।`;
  }
  return `No matching ${asked} package is available right now. Verified options we do have: ${options}. I can share those details if you want.`;
}

export function decideInformationResponse(input: {
  message: string;
  industry?: string | null;
  evidence?: InformationEvidence;
  handoffTriggers?: HandoffTriggers;
}): InformationDecision {
  const message = input.message || '';
  const evidence = input.evidence || {};
  const language = detectReplyLanguage(message);
  const industryFamily = resolveIndustryPolicyFamily(input.industry);
  const questionType = classifyQuestion(message, input.industry);
  const triggers = detectHandoffTriggers(message, input.handoffTriggers);
  const resolvedFacts = resolveAuthoritativeFacts(evidence);
  const similarSuggestions = evidence.similarSuggestions || [];

  const forcedHandoff =
    triggers.humanRequested ||
    triggers.complaint ||
    triggers.bookingPaymentIssue ||
    triggers.sensitive ||
    triggers.highValue;

  const base = {
    questionType,
    resolvedFacts,
    similarSuggestions,
    industryFamily,
    language,
    allowGeneralKnowledge: questionType === 'general',
  };

  const failedSources = evidence.failedSources || [];
  const databaseLookupFailed =
    evidence.retrievalFailed === true &&
    (evidence.retrievalErrorSource === 'database' ||
      evidence.retrievalErrorSource === 'search' ||
      !evidence.retrievalErrorSource) &&
    failedSources.length === 0;
  const askedPrice = hasAny(message, PRICE_FIELD_RE);
  const factsAnswerAsk =
    resolvedFacts.length > 0 &&
    (!askedPrice ||
      resolvedFacts.some(
        (fact) =>
          fact.field === 'price' ||
          fact.field === 'fee' ||
          PRICE_IN_TEXT_RE.test(fact.value)
      ));
  const namedResolvedFact = resolvedFacts.some(
    (fact) => fact.entity && queryMentions(message, fact.entity)
  );
  // A source outage is only a system error when no authorized source
  // (including the tenant knowledge base) already answered the question.
  const treatAsSystemError =
    !factsAnswerAsk &&
    (failedSources.includes('database') ||
      databaseLookupFailed ||
      (failedSources.includes('knowledge_base') &&
        evidence.databaseFacts === undefined &&
        !evidence.similarSuggestions?.length &&
        questionType !== 'general'));

  if (treatAsSystemError) {
    return {
      ...base,
      outcome: 'system_error',
      answerSource: 'none',
      answerConfidence: 'low',
      handoffRequired: true,
      handoffReason: 'System could not verify information',
      fallbackMessage: fallbackCopy(industryFamily, 'system_error', language),
    };
  }

  if (questionType === 'general') {
    return {
      ...base,
      outcome: 'general_knowledge',
      answerSource: 'general_knowledge',
      answerConfidence: 'medium',
      handoffRequired: forcedHandoff,
      handoffReason: forcedHandoff ? 'Sensitive or requested human help' : undefined,
      allowGeneralKnowledge: true,
    };
  }

  if (factsAnswerAsk) {
    if (isAmbiguousBusinessAsk(message) && !evidence.multipleMatches) {
      return {
        ...base,
        outcome: 'clarification',
        answerSource: resolvedFacts[0].source,
        answerConfidence: 'medium',
        handoffRequired: forcedHandoff,
        handoffReason: forcedHandoff ? 'Customer requested human help' : undefined,
        clarificationPrompt: clarificationCopy(message, industryFamily, language),
      };
    }

    if (evidence.multipleMatches && !namedResolvedFact) {
      return {
        ...base,
        outcome: 'clarification',
        answerSource: resolvedFacts[0].source,
        answerConfidence: 'medium',
        handoffRequired: forcedHandoff,
        clarificationPrompt: clarificationCopy(message, industryFamily, language),
      };
    }

    const topSource = resolvedFacts.reduce((best, fact) =>
      SOURCE_PRIORITY[fact.source] < SOURCE_PRIORITY[best.source] ? fact : best
    ).source;

    return {
      ...base,
      outcome: 'direct_answer',
      answerSource: topSource,
      answerConfidence: topSource === 'database' ? 'high' : 'high',
      handoffRequired: forcedHandoff,
      handoffReason: forcedHandoff ? 'Follow-up still needs a human' : undefined,
    };
  }

  if (evidence.missingRequestedField && hasAny(message, PRICE_FIELD_RE)) {
    return {
      ...base,
      outcome: 'safe_fallback',
      answerSource: 'none',
      answerConfidence: 'low',
      handoffRequired: true,
      handoffReason: 'Business information unavailable',
      fallbackMessage: fallbackCopy(industryFamily, 'missing_price', language),
    };
  }

  if (similarSuggestions.length > 0) {
    return {
      ...base,
      outcome: 'similar_suggestion',
      answerSource: 'database',
      answerConfidence: 'medium',
      handoffRequired: false,
      fallbackMessage: similarSuggestionCopy(
        similarSuggestions,
        message,
        language
      ),
    };
  }

  if (
    isAmbiguousBusinessAsk(message) &&
    resolvedFacts.length === 0 &&
    !forcedHandoff &&
    questionType !== 'action'
  ) {
    // No verified data yet — do not pretend clarification will invent a match.
    // Fall through to the safe fallback.
  }

  const noMatchKind: 'no_match' | 'no_data' =
    industryFamily === 'travel' && hasAny(message, PACKAGE_ENTITY_RE)
      ? 'no_match'
      : 'no_data';

  return {
    ...base,
    outcome: 'safe_fallback',
    answerSource: 'none',
    answerConfidence: 'low',
    handoffRequired: true,
    handoffReason:
      triggers.humanRequested
        ? 'Customer requested human help'
        : triggers.complaint
          ? 'Complaint requires staff'
          : triggers.bookingPaymentIssue
            ? 'Booking or payment issue'
            : triggers.sensitive
              ? 'Sensitive question'
              : triggers.highValue
                ? 'High-value customer'
                : 'Business information unavailable',
    fallbackMessage: fallbackCopy(industryFamily, noMatchKind, language),
  };
}

export function toAnswerMetadata(decision: InformationDecision): AnswerMetadata {
  return {
    answer_source: decision.answerSource,
    answer_confidence: decision.answerConfidence,
    handoff_required: decision.handoffRequired,
    question_type: decision.questionType,
    outcome: decision.outcome,
  };
}

export function replyContainsUnverifiedPrice(
  reply: string,
  facts: RetrievedFact[]
): boolean {
  if (!PRICE_IN_TEXT_RE.test(reply)) return false;
  const verified = facts
    .map((fact) => fact.value)
    .join(' ')
    .replace(/[^\d]/g, '');
  const amounts = [...reply.matchAll(/\d{1,3}(?:,\d{3})+|\d{4,7}/g)].map((m) =>
    m[0].replace(/,/g, '')
  );
  if (amounts.length === 0) return false;
  if (!verified) return true;
  return amounts.some((amount) => !verified.includes(amount));
}

/**
 * Last-line production guard: never let a business reply invent a price,
 * and never describe a system outage as "information is unavailable".
 */
export function applyInformationGuard(
  reply: string,
  decision: InformationDecision
): string {
  if (decision.outcome === 'system_error' && decision.fallbackMessage) {
    return decision.fallbackMessage;
  }

  if (
    decision.outcome === 'safe_fallback' &&
    decision.fallbackMessage &&
    (decision.resolvedFacts.length === 0 ||
      replyContainsUnverifiedPrice(reply, decision.resolvedFacts))
  ) {
    return decision.fallbackMessage;
  }

  if (
    decision.outcome === 'similar_suggestion' &&
    decision.fallbackMessage &&
    replyContainsUnverifiedPrice(reply, decision.resolvedFacts)
  ) {
    return decision.fallbackMessage;
  }

  if (
    decision.questionType === 'business' &&
    decision.resolvedFacts.length === 0 &&
    !decision.allowGeneralKnowledge &&
    replyContainsUnverifiedPrice(reply, decision.resolvedFacts) &&
    decision.fallbackMessage
  ) {
    return decision.fallbackMessage;
  }

  if (
    decision.outcome === 'clarification' &&
    decision.clarificationPrompt &&
    !/\?|নাকি|কি\s+জানতে/.test(reply)
  ) {
    return decision.clarificationPrompt;
  }

  return reply;
}

export function buildInformationPolicyPrompt(
  industry?: string | null
): string {
  const family = resolveIndustryPolicyFamily(industry);
  const entities =
    family === 'travel'
      ? 'tour packages, prices, availability, itineraries, hotels, inclusions, bookings'
      : family === 'hospital'
        ? 'doctors, fees, timings, appointments, services'
        : family === 'coaching'
          ? 'courses, fees, batches, timings, admission'
          : 'business knowledge, services, pricing, policies';

  return `${INFORMATION_POLICY_MARKER}
SOURCE OF TRUTH (authorized only):
1. Tenant knowledge base — the SaaS workspace catalog the owner maintains (prices, cards, plans, packages, fees, policies)
2. Real-time database — live operational records only (travel inventory, doctor roster, appointments)
3. Conversation context (already confirmed staff details only)
4. Business configuration
5. General AI knowledge — ONLY for non-business / general questions

RULES:
- Business facts (${entities}) MUST come from authorized sources. Never use general AI knowledge for this workplace's prices, packages, fees, schedules, availability, or records.
- Most workspace prices, cards, and plans live in the knowledge base. If the fact is there, answer it directly. Do not require the same fact to also exist in a database table.
- Knowing something generally does NOT mean this business offers it. Never say "our hotel starts from ₹2,000" unless that rate is in the knowledge base or database.
- If an exact verified fact is present, answer it directly. Do not add an unnecessary disclaimer.
- If the request is ambiguous (price vs full details) and data exists, ask one clarification question first.
- If no matching business data exists after exact, synonym, and context search: never guess. Say it is not verified, then offer a useful next step (team confirmation / handoff).
- Database/search failure is NOT "no data". If retrieval failed, say you cannot verify it right now and offer team confirmation.
- Never invent a travel package, another agency's package, or an approximate price.
- If a nearby verified package exists, you MAY suggest that real database option. Nothing else.
- When two sources disagree: Real-time DB > Knowledge Base > static configuration.
- Set handoff_required=true for unavailable business facts, booking/payment issues, complaints, sensitive questions, high-value customers, or an explicit human request.
- Never show answer_source, answer_confidence, or handoff_required to the customer.`;
}

export function withInformationPolicy(
  prompt: string,
  industry: string | null | undefined
): string {
  const trimmed = prompt.trim();
  if (trimmed.includes(INFORMATION_POLICY_MARKER)) return trimmed;
  return [trimmed, buildInformationPolicyPrompt(industry)]
    .filter(Boolean)
    .join('\n\n');
}

export function formatInformationDecisionForPrompt(
  decision: InformationDecision
): string {
  const facts =
    decision.resolvedFacts.length > 0
      ? decision.resolvedFacts
          .map(
            (fact) =>
              `- ${fact.entity || fact.key}: ${fact.value} [source=${fact.source}]`
          )
          .join('\n')
      : '- none';
  const similar =
    decision.similarSuggestions.length > 0
      ? decision.similarSuggestions
          .map(
            (row) =>
              `- ${row.label}${row.detail ? ` (${row.detail})` : ''}${row.price ? ` ${row.price}` : ''}`
          )
          .join('\n')
      : '- none';

  const lines = [
    '[INFORMATION POLICY DECISION — INTERNAL]',
    `question_type: ${decision.questionType}`,
    `outcome: ${decision.outcome}`,
    `answer_source: ${decision.answerSource}`,
    `answer_confidence: ${decision.answerConfidence}`,
    `handoff_required: ${decision.handoffRequired}`,
    `allow_general_knowledge: ${decision.allowGeneralKnowledge}`,
    'resolved_facts:',
    facts,
    'similar_verified_options:',
    similar,
  ];

  if (decision.outcome === 'direct_answer') {
    lines.push(
      'INSTRUCTION: Answer the asked fact directly from resolved_facts. No disclaimer.'
    );
  } else if (decision.outcome === 'clarification' && decision.clarificationPrompt) {
    lines.push(`INSTRUCTION: Ask exactly this clarification: "${decision.clarificationPrompt}"`);
  } else if (decision.outcome === 'similar_suggestion' && decision.fallbackMessage) {
    lines.push(
      `INSTRUCTION: Do not invent a missing package. You may only offer the similar_verified_options. Preferred wording: "${decision.fallbackMessage}"`
    );
  } else if (decision.outcome === 'system_error' && decision.fallbackMessage) {
    lines.push(
      `INSTRUCTION: Retrieval failed. Do NOT say the information is unavailable. Reply: "${decision.fallbackMessage}"`
    );
  } else if (decision.outcome === 'safe_fallback' && decision.fallbackMessage) {
    lines.push(
      `INSTRUCTION: No verified match. Do not guess. Reply: "${decision.fallbackMessage}"`
    );
  } else if (decision.outcome === 'general_knowledge') {
    lines.push(
      'INSTRUCTION: This is a general question. You may use general knowledge. Do not claim this business offers those things.'
    );
  }

  return lines.join('\n');
}

const STAFF_SENDERS = new Set(['agent', 'staff', 'human']);

/**
 * Conversation is the lowest-trust source. Only human staff messages may
 * contribute facts. Bot/AI prices are never trusted — they may be prior
 * hallucinations. Customer messages never supply prices either.
 */
export function factsFromStaffConversation(
  messages: Array<{
    sender_type?: string | null;
    content_text?: string | null;
    content?: string | null;
  }>,
  query: string
): RetrievedFact[] {
  const facts: RetrievedFact[] = [];
  for (const message of messages || []) {
    const sender = String(message.sender_type || '').toLowerCase();
    if (!STAFF_SENDERS.has(sender)) continue;
    const text = (message.content_text || message.content || '').trim();
    if (!text) continue;
    const priceRe =
      /(?:Dr\.?\s*)?([A-Za-z\u0980-\u09FF][\w\u0980-\u09FF .]{1,40}?)\s*(?:package|card|plan|course|fee|price|rate)?\s*(?:is|=|:|—|-)?\s*(?:₹|rs\.?|inr)\s*([0-9,]+)/gi;
    let match: RegExpExecArray | null;
    while ((match = priceRe.exec(text)) !== null) {
      const entity = match[1]
        .trim()
        .replace(/\s+(package|card|plan|course|fee|price|rate)$/i, '');
      const amount = Number(match[2].replace(/,/g, ''));
      if (!entity || entity.length < 2 || !Number.isFinite(amount) || amount <= 0) {
        continue;
      }
      facts.push({
        key: `${entity}.price`,
        value: `₹${amount.toLocaleString('en-IN')}`,
        source: 'conversation',
        entity,
        field: 'price',
      });
    }
  }
  if (facts.length === 0) return [];
  const q = (query || '').toLowerCase();
  const mentioned = facts.filter(
    (fact) => fact.entity && q.includes(fact.entity.toLowerCase())
  );
  return mentioned.length > 0 ? mentioned : facts;
}

/**
 * Static workspace configuration. Never extract prices from welcome copy —
 * marketing text goes stale and is not a verified rate card.
 */
export function factsFromBusinessConfiguration(input: {
  businessName?: string | null;
  welcomeMessage?: string | null;
  query?: string;
}): RetrievedFact[] {
  const facts: RetrievedFact[] = [];
  const query = input.query || '';

  if (
    input.businessName?.trim() &&
    /\b(name|called|business|agency|clinic|hospital|institute|academy)\b/i.test(
      query
    )
  ) {
    facts.push({
      key: 'business.name',
      value: input.businessName.trim(),
      source: 'configuration',
      field: 'name',
    });
  }

  const welcome = input.welcomeMessage || '';
  if (
    welcome &&
    !PRICE_IN_TEXT_RE.test(welcome) &&
    /\b(hour|hours|timing|timings|open|close|am|pm)\b/i.test(query)
  ) {
    const hours = welcome.match(
      /(?:open|hours?|timing|timings)[:\s]+([^.\n]{3,80})/i
    );
    if (hours?.[1]?.trim()) {
      facts.push({
        key: 'business.hours',
        value: hours[1].trim(),
        source: 'configuration',
        field: 'hours',
      });
    }
  }

  return facts;
}

export function factsFromKnowledgeItems(
  items: Array<{ question_title?: string; answer_content?: string; category?: string }>,
  query: string
): RetrievedFact[] {
  const q = (query || '').toLowerCase();
  return (items || [])
    .filter((item) => {
      const hay = `${item.question_title || ''} ${item.answer_content || ''} ${item.category || ''}`.toLowerCase();
      if (!q.trim()) return true;
      return q
        .split(/\s+/)
        .filter((token) => token.length > 2)
        .some((token) => hay.includes(token));
    })
    .slice(0, 8)
    .map((item) => ({
      key: (item.question_title || 'kb').toLowerCase(),
      value: item.answer_content || '',
      source: 'knowledge_base' as const,
      entity: item.question_title || undefined,
      field: hasAny(
        `${item.question_title} ${item.answer_content}`,
        PRICE_FIELD_RE
      )
        ? 'price'
        : item.category || 'info',
    }));
}
