import { NormalizedVoiceWebhook } from '@/core/providers/voice/voice-provider.interface';

export type CallState = NonNullable<NormalizedVoiceWebhook['status']>;

const TERMINAL_STATES: ReadonlySet<CallState> = new Set([
  'completed',
  'failed',
  'busy',
  'no_answer',
  'cancelled',
]);

const ALLOWED_TRANSITIONS: Record<CallState, ReadonlySet<CallState>> = {
  queued: new Set(['initiating', 'failed', 'cancelled']),
  initiating: new Set([
    'ringing',
    'in_progress',
    'completed',
    'failed',
    'cancelled',
  ]),
  ringing: new Set([
    'in_progress',
    'completed',
    'failed',
    'cancelled',
    'no_answer',
    'busy',
  ]),
  in_progress: new Set(['completed', 'failed', 'cancelled']),
  completed: new Set(),
  failed: new Set(),
  busy: new Set(),
  no_answer: new Set(),
  cancelled: new Set(),
};

/**
 * Returns true if transition from `current` state to `next` state is valid.
 * If `current` is missing or undefined, transition to initial states (`queued`, `initiating`, `ringing`, `in_progress`) is permitted.
 */
export function isValidCallStateTransition(
  current: CallState | undefined,
  next: CallState
): boolean {
  if (!current) return true;
  if (current === next) return true; // Idempotent same-state updates are allowed
  if (TERMINAL_STATES.has(current)) return false; // Terminal states can never regress
  const allowed = ALLOWED_TRANSITIONS[current];
  return allowed ? allowed.has(next) : false;
}

export function isTerminalCallState(status: CallState | undefined): boolean {
  if (!status) return false;
  return TERMINAL_STATES.has(status);
}
