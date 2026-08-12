import { VoiceProviderError } from '@/core/providers/voice/voice-provider.interface';

export type CallStatus =
  | 'queued'
  | 'initiating'
  | 'ringing'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'busy'
  | 'no_answer'
  | 'cancelled';

export const ACTIVE_CALL_STATUSES: readonly CallStatus[] = [
  'queued',
  'initiating',
  'ringing',
  'in_progress',
];

export const TERMINAL_CALL_STATUSES: readonly CallStatus[] = [
  'completed',
  'failed',
  'busy',
  'no_answer',
  'cancelled',
];

export const ALLOWED_TRANSITIONS: Record<CallStatus, readonly CallStatus[]> = {
  queued: ['initiating', 'failed', 'cancelled'],
  initiating: [
    'ringing',
    'in_progress',
    'completed',
    'failed',
    'busy',
    'no_answer',
    'cancelled',
  ],
  ringing: [
    'in_progress',
    'completed',
    'failed',
    'busy',
    'no_answer',
    'cancelled',
  ],
  in_progress: ['completed', 'failed', 'cancelled'],
  completed: [],
  failed: [],
  busy: [],
  no_answer: [],
  cancelled: [],
};

export class CallStateMachine {
  static isTerminal(status: CallStatus): boolean {
    return TERMINAL_CALL_STATUSES.includes(status);
  }

  static canTransition(
    current: CallStatus | undefined | null,
    target: CallStatus
  ): boolean {
    const from = current || 'queued';
    if (from === target) return true; // Idempotent same-state transition
    const allowed = ALLOWED_TRANSITIONS[from] || [];
    return allowed.includes(target);
  }

  static validateTransition(
    current: CallStatus | undefined | null,
    target: CallStatus
  ): void {
    if (!this.canTransition(current, target)) {
      throw new VoiceProviderError(
        'VOICE_INVALID_STATE_TRANSITION',
        `Invalid call state transition from '${current || 'none'}' to '${target}'`,
        422
      );
    }
  }
}

export type CallState = CallStatus;

export function isValidCallStateTransition(
  current: CallStatus | undefined | null,
  target: CallStatus
): boolean {
  return CallStateMachine.canTransition(current, target);
}

export function isTerminalCallState(
  status: CallStatus | undefined | null
): boolean {
  return Boolean(status && CallStateMachine.isTerminal(status));
}
