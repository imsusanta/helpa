import { describe, it, expect } from 'vitest';
import {
  isValidCallStateTransition,
  isTerminalCallState,
} from '@/lib/voice/call-state-machine';

describe('Call State Machine', () => {
  it('allows valid state progression', () => {
    expect(isValidCallStateTransition(undefined, 'initiating')).toBe(true);
    expect(isValidCallStateTransition('initiating', 'ringing')).toBe(true);
    expect(isValidCallStateTransition('ringing', 'in_progress')).toBe(true);
    expect(isValidCallStateTransition('in_progress', 'completed')).toBe(true);
  });

  it('allows idempotent same-state updates', () => {
    expect(isValidCallStateTransition('in_progress', 'in_progress')).toBe(true);
    expect(isValidCallStateTransition('completed', 'completed')).toBe(true);
  });

  it('prevents regression from terminal states to active states', () => {
    expect(isValidCallStateTransition('completed', 'in_progress')).toBe(false);
    expect(isValidCallStateTransition('failed', 'initiating')).toBe(false);
    expect(isValidCallStateTransition('busy', 'ringing')).toBe(false);
  });

  it('correctly identifies terminal states', () => {
    expect(isTerminalCallState('completed')).toBe(true);
    expect(isTerminalCallState('failed')).toBe(true);
    expect(isTerminalCallState('in_progress')).toBe(false);
    expect(isTerminalCallState('initiating')).toBe(false);
  });
});
