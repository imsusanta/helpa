/**
 * Stop-intent detection for follow-up. Short, explicit opt-out phrases
 * stop automation. Longer conversational uses of the same words do not.
 */
export type StopIntentKind = 'stop' | 'negative' | null;

const STOP_EXACT = new Set([
  'stop',
  'stop.',
  'unsubscribe',
  'unsub',
  'opt out',
  'opt-out',
  'optout',
  'stop messages',
  'stop messaging',
  'stop whatsapp',
  'please stop',
  'please unsubscribe',
]);

const NEGATIVE_EXACT = new Set([
  'not interested',
  'not interested.',
  'no thanks',
  'no thank you',
  "don't contact me",
  'do not contact me',
  "don't message me",
  'do not message me',
  'please don t contact',
  "please don't contact",
  'leave me alone',
]);

export function detectStopIntent(
  text: string | null | undefined
): StopIntentKind {
  const cleaned = (text || '')
    .trim()
    .toLowerCase()
    .replace(/[!]+/g, '')
    .replace(/\s+/g, ' ');
  if (!cleaned) return null;

  if (STOP_EXACT.has(cleaned)) return 'stop';
  if (NEGATIVE_EXACT.has(cleaned)) return 'negative';

  // Allow a trailing please / thanks on an otherwise exact STOP.
  const stripped = cleaned.replace(/\b(please|thanks|thank you)\b/g, '').trim();
  if (STOP_EXACT.has(stripped)) return 'stop';

  // Only treat negative intent as a stop when the whole (short) message
  // is the opt-out. "I am not interested in insurance, I want the Goa
  // package" must continue.
  if (cleaned.length <= 60 && NEGATIVE_EXACT.has(cleaned)) return 'negative';

  return null;
}
