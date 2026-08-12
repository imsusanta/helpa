import { describe, it, expect } from 'vitest';
import { CallStateMachine } from '@/lib/voice/call-state-machine';

describe('Voice System Security, State Machine & Pipeline Controls', () => {
  describe('CallStateMachine Lifecycle Validation', () => {
    it('allows valid progressive transitions', () => {
      expect(CallStateMachine.canTransition('queued', 'initiating')).toBe(true);
      expect(CallStateMachine.canTransition('initiating', 'ringing')).toBe(
        true
      );
      expect(CallStateMachine.canTransition('ringing', 'in_progress')).toBe(
        true
      );
      expect(CallStateMachine.canTransition('in_progress', 'completed')).toBe(
        true
      );
    });

    it('locks terminal states and rejects regressive transitions', () => {
      expect(CallStateMachine.canTransition('completed', 'in_progress')).toBe(
        false
      );
      expect(CallStateMachine.canTransition('failed', 'initiating')).toBe(
        false
      );
      expect(CallStateMachine.canTransition('cancelled', 'ringing')).toBe(
        false
      );
      expect(CallStateMachine.canTransition('busy', 'in_progress')).toBe(false);
    });

    it('treats identical state transitions as idempotent', () => {
      expect(CallStateMachine.canTransition('in_progress', 'in_progress')).toBe(
        true
      );
      expect(CallStateMachine.canTransition('completed', 'completed')).toBe(
        true
      );
    });

    it('throws VoiceProviderError on invalid transition validation', () => {
      expect(() =>
        CallStateMachine.validateTransition('completed', 'in_progress')
      ).toThrow();
    });
  });
});
