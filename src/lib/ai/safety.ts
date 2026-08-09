/**
 * Production AI Safety & Healthcare Guardrails Module
 *
 * Provides real-time emergency intent detection, non-diagnostic boundaries,
 * human doctor escalation, and prompt injection defense for WhatsApp AI Receptionist.
 */

export const EMERGENCY_KEYWORDS = [
  'chest pain',
  'severe bleeding',
  'difficulty breathing',
  'unconscious',
  'stroke symptoms',
  'heart attack',
  'seizure',
  'anaphylaxis',
  'poisoning',
  'head injury',
  'breathlessness',
  'cardiac arrest',
  'heavy bleeding',
  'choking',
] as const;

export const DIAGNOSTIC_KEYWORDS = [
  'diagnose',
  'prescribe',
  'what disease do i have',
  'what illness do i have',
  'which medicine should i take',
  'dosage for',
  'what medication should i',
  'cure for my',
  'treatment for my condition',
] as const;

export const PROMPT_INJECTION_PATTERNS = [
  'system overide',
  'system override',
  'ignore previous',
  'ignore all previous',
  'output system',
  'print api key',
  'disregard system prompt',
  'you are now DAN',
  'bypass safety',
  'developer mode',
  'system prompt',
  'forget instructions',
] as const;

/**
 * Normalizes input text by applying Unicode NFKC normalization,
 * removing zero-width/control characters, stripping non-alphanumeric separators,
 * and collapsing whitespace.
 */
export function normalizeInput(input: string): string {
  if (!input || typeof input !== 'string') return '';
  return (
    input
      .normalize('NFKC')
      // Remove zero-width spaces and control characters
      .replace(/[\u200B-\u200D\uFEFF\u0000-\u001F]/g, '')
      .toLowerCase()
      // Replace non-alphanumeric punctuation with spaces for keyword matching
      .replace(/[-_.,/\\()[\]{}:;!?"']/g, ' ')
      // Collapse multiple spaces into one
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/**
 * Checks if patient message contains emergency medical symptoms requiring immediate hotline intervention.
 */
export function isEmergencyQuery(input: string): boolean {
  if (!input) return false;
  const normalized = normalizeInput(input);
  if (!normalized) return false;
  return EMERGENCY_KEYWORDS.some((kw) => {
    const normKw = normalizeInput(kw);
    return normalized.includes(normKw);
  });
}

/**
 * Checks if patient message requests medical diagnosis or prescription advice.
 */
export function isDiagnosticRequest(input: string): boolean {
  if (!input) return false;
  const normalized = normalizeInput(input);
  if (!normalized) return false;
  return DIAGNOSTIC_KEYWORDS.some((kw) => {
    const normKw = normalizeInput(kw);
    return normalized.includes(normKw);
  });
}

/**
 * Detects adversarial prompt injection attempts in patient or knowledge base inputs.
 */
export function containsPromptInjection(input: string): boolean {
  if (!input) return false;
  const normalized = normalizeInput(input);
  if (!normalized) return false;
  return PROMPT_INJECTION_PATTERNS.some((pattern) => {
    const normPattern = normalizeInput(pattern);
    return normalized.includes(normPattern);
  });
}

/**
 * Sanitizes input text by removing prompt injection markers before sending to LLM API.
 */
export function sanitizeAiInput(input: string): string {
  if (!input) return '';
  let sanitized = input;
  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    const regex = new RegExp(pattern.replace(/\s+/g, '\\s+'), 'gi');
    sanitized = sanitized.replace(regex, '[REDACTED_PROMPT_INJECTION]');
  }
  return sanitized.trim();
}

export interface AiSafetyResult {
  safeText: string;
  isEmergency: boolean;
  isDiagnostic: boolean;
  containsInjection: boolean;
}

/**
 * Unified AI Safety evaluator for pre-model-call guardrail enforcement.
 */
export function applyAiSafety(input: string): AiSafetyResult {
  if (!input) {
    return {
      safeText: '',
      isEmergency: false,
      isDiagnostic: false,
      containsInjection: false,
    };
  }
  const isEmergency = isEmergencyQuery(input);
  const isDiagnostic = isDiagnosticRequest(input);
  const containsInjection = containsPromptInjection(input);
  const safeText = containsInjection ? sanitizeAiInput(input) : input;

  return {
    safeText,
    isEmergency,
    isDiagnostic,
    containsInjection,
  };
}
