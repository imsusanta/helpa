/**
 * Server-side validation for AI lead-detection output.
 *
 * Never trust arbitrary model JSON. Heuristics run first so a greeting
 * cannot become a sales lead even if the model claims otherwise.
 */
import {
  LEAD_INTENT_LEVELS,
  LEAD_SCORE_LABELS,
  type LeadDetectionResult,
  type LeadIntentLevel,
  type LeadScoreLabel,
} from '@/lib/leads/types';

const GREETING_EXACT = new Set([
  'hi',
  'hii',
  'hiii',
  'hello',
  'helloo',
  'hey',
  'heya',
  'hiya',
  'yo',
  'sup',
  'hola',
  'namaste',
  'namaskar',
  'good morning',
  'good afternoon',
  'good evening',
  'gm',
  'gn',
  'ok',
  'okay',
  'k',
  'kk',
  'thanks',
  'thank you',
  'thx',
  'ty',
  '👍',
  '🙏',
  '🙂',
  '😊',
]);

const ENQUIRY_KEYWORDS = [
  'price',
  'pricing',
  'cost',
  'rate',
  'rates',
  'package',
  'packages',
  'quote',
  'quotation',
  'book',
  'booking',
  'appointment',
  'available',
  'availability',
  'interested',
  'want',
  'need',
  'looking for',
  'tour',
  'property',
  'flat',
  'apartment',
  'villa',
  'plot',
  'course',
  'admission',
  'fees',
  'fee',
  'treatment',
  'consultation',
  'doctor',
  'dentist',
  'dental',
  'buy',
  'purchase',
  'site visit',
  'demo',
  'enquiry',
  'inquiry',
  'details',
  'info',
  'information',
];

const HIGH_INTENT_KEYWORDS = [
  'book',
  'booking',
  'appointment',
  'tomorrow',
  'today',
  'buy',
  'purchase',
  'confirm',
  'ready to',
  'want to book',
  'i want',
];

export function normalizeMessageText(text: string | null | undefined): string {
  return (text || '')
    .replace(/\s+/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim();
}

export function looksLikeGreeting(text: string): boolean {
  const cleaned = normalizeMessageText(text)
    .toLowerCase()
    .replace(/[!.,?]+$/g, '')
    .trim();
  if (!cleaned) return true;
  if (GREETING_EXACT.has(cleaned)) return true;
  if (
    cleaned.length <= 12 &&
    GREETING_EXACT.has(cleaned.replace(/[.!,]+/g, ''))
  ) {
    return true;
  }
  // "Hi there" / "Hello sir" without any enquiry keyword is still a greeting.
  const words = cleaned.split(' ');
  if (
    words.length <= 3 &&
    GREETING_EXACT.has(words[0] || '') &&
    !ENQUIRY_KEYWORDS.some((k) => cleaned.includes(k))
  ) {
    return true;
  }
  return false;
}

export function looksLikeBusinessEnquiry(text: string): boolean {
  const cleaned = normalizeMessageText(text).toLowerCase();
  if (!cleaned || looksLikeGreeting(cleaned)) return false;
  if (
    cleaned.length < 8 &&
    !ENQUIRY_KEYWORDS.some((k) => cleaned.includes(k))
  ) {
    return false;
  }
  return ENQUIRY_KEYWORDS.some((k) => cleaned.includes(k));
}

export function clampConfidence(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

export function clampScore(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(Math.min(100, Math.max(0, n)));
}

export function scoreLabelFromNumeric(score: number): LeadScoreLabel {
  if (score >= 70) return 'hot';
  if (score >= 40) return 'warm';
  return 'cold';
}

export function numericFromScoreLabel(
  label: string | null | undefined
): number {
  switch ((label || '').toLowerCase()) {
    case 'hot':
      return 85;
    case 'warm':
      return 55;
    case 'cold':
      return 20;
    default:
      return 0;
  }
}

function asIntent(value: unknown): LeadIntentLevel {
  const raw = String(value || '')
    .toLowerCase()
    .trim();
  if ((LEAD_INTENT_LEVELS as readonly string[]).includes(raw)) {
    return raw as LeadIntentLevel;
  }
  if (raw === 'sales' || raw === 'booking') return 'high';
  if (raw === 'support' || raw === 'complaint') return 'low';
  return 'none';
}

function asScoreLabel(value: unknown): LeadScoreLabel {
  const raw = String(value || '')
    .toLowerCase()
    .trim();
  if ((LEAD_SCORE_LABELS as readonly string[]).includes(raw)) {
    return raw as LeadScoreLabel;
  }
  return 'cold';
}

function asNullableString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === 'null' || trimmed === 'undefined') {
    return null;
  }
  return trimmed.slice(0, 500);
}

const EMPTY_DETECTION: LeadDetectionResult = {
  is_business_enquiry: false,
  intent: 'none',
  lead_confidence: 0,
  service: null,
  summary: null,
  requires_qualification: false,
  budget: null,
  timeline: null,
  next_action: null,
  score_label: 'cold',
  score_numeric: 0,
};

/**
 * Infer a conservative detection result from the inbound text alone.
 * Used to reject greeting-as-lead and to skip an extra model call.
 */
export function heuristicDetection(messageText: string): LeadDetectionResult {
  const text = normalizeMessageText(messageText);
  if (!text || looksLikeGreeting(text)) {
    return { ...EMPTY_DETECTION };
  }

  const enquiry = looksLikeBusinessEnquiry(text);
  if (!enquiry) {
    return {
      ...EMPTY_DETECTION,
      summary: null,
      lead_confidence: 0.15,
    };
  }

  const lowered = text.toLowerCase();
  const high = HIGH_INTENT_KEYWORDS.some((k) => lowered.includes(k));
  const intent: LeadIntentLevel = high ? 'high' : 'medium';
  const score_numeric = high ? 82 : 58;
  return {
    is_business_enquiry: true,
    intent,
    lead_confidence: high ? 0.8 : 0.55,
    service: null,
    summary: text.slice(0, 180),
    requires_qualification: true,
    budget: null,
    timeline: null,
    next_action: null,
    score_label: scoreLabelFromNumeric(score_numeric),
    score_numeric,
  };
}

/**
 * Validate and clamp a raw AI JSON object. Heuristic veto still applies:
 * a greeting can never become a sales lead.
 */
export function validateLeadDetection(
  raw: unknown,
  messageText: string
): LeadDetectionResult {
  const heuristic = heuristicDetection(messageText);
  if (!heuristic.is_business_enquiry) {
    return heuristic;
  }

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return heuristic;
  }

  const payload = raw as Record<string, unknown>;
  const extracted =
    payload.extracted_lead_info &&
    typeof payload.extracted_lead_info === 'object' &&
    !Array.isArray(payload.extracted_lead_info)
      ? (payload.extracted_lead_info as Record<string, unknown>)
      : {};

  const claimedEnquiry =
    payload.is_business_enquiry === true ||
    payload.sales_signal === true ||
    payload.is_business_enquiry === 'true';

  const confidence = clampConfidence(
    payload.lead_confidence ?? payload.confidence ?? heuristic.lead_confidence
  );

  // The heuristic already vetoed greetings. If the model omitted or
  // low-confidently denied an enquiry flag, keep the conservative
  // keyword result rather than dropping a real "package price?" lead.
  if (!claimedEnquiry || confidence < 0.4) {
    return {
      ...heuristic,
      lead_confidence: Math.max(heuristic.lead_confidence, confidence),
      summary: asNullableString(payload.summary) || heuristic.summary,
      service:
        asNullableString(payload.service) ||
        asNullableString(extracted.interested_service) ||
        heuristic.service,
      budget:
        asNullableString(payload.budget) ||
        asNullableString(extracted.budget) ||
        heuristic.budget,
      timeline:
        asNullableString(payload.timeline) ||
        asNullableString(extracted.timeline) ||
        heuristic.timeline,
    };
  }

  let score_numeric = Number.isFinite(Number(payload.score_numeric))
    ? clampScore(payload.score_numeric)
    : numericFromScoreLabel(
        (payload.lead_score as string) || heuristic.score_label
      );
  if (score_numeric === 0) {
    score_numeric = heuristic.score_numeric;
  }

  const intent = asIntent(
    payload.intent || payload.buying_intent || heuristic.intent
  );
  if (intent === 'high' && score_numeric < 70) {
    score_numeric = Math.max(score_numeric, 75);
  }

  return {
    is_business_enquiry: true,
    intent: intent === 'none' ? heuristic.intent : intent,
    lead_confidence: Math.max(confidence, 0.4),
    service:
      asNullableString(payload.service) ||
      asNullableString(extracted.interested_service) ||
      heuristic.service,
    summary: asNullableString(payload.summary) || heuristic.summary,
    requires_qualification:
      payload.requires_qualification === false ? false : true,
    budget:
      asNullableString(payload.budget) ||
      asNullableString(extracted.budget) ||
      null,
    timeline:
      asNullableString(payload.timeline) ||
      asNullableString(extracted.timeline) ||
      null,
    next_action:
      asNullableString(payload.next_action) ||
      asNullableString(extracted.next_action) ||
      null,
    score_label: asScoreLabel(
      payload.lead_score || scoreLabelFromNumeric(score_numeric)
    ),
    score_numeric,
  };
}

/**
 * Map existing receptionist insights onto the validated detection shape.
 */
export function detectionFromInsights(
  insights: {
    salesSignal?: boolean;
    intent?: string;
    leadScore?: string;
    summary?: string | null;
    interestedService?: string | null;
    budget?: string | null;
    timeline?: string | null;
    nextAction?: string | null;
  },
  messageText: string
): LeadDetectionResult {
  return validateLeadDetection(
    {
      is_business_enquiry: !!insights.salesSignal,
      sales_signal: !!insights.salesSignal,
      intent: insights.intent,
      lead_score: insights.leadScore,
      summary: insights.summary,
      extracted_lead_info: {
        interested_service: insights.interestedService,
        budget: insights.budget,
        timeline: insights.timeline,
        next_action: insights.nextAction,
      },
    },
    messageText
  );
}
