import { describe, expect, it } from 'vitest';
import { detectStopIntent } from './stop-intent';
import {
  canScheduleReminder,
  parseFollowupPolicy,
  reminderDueAt,
} from './followup-policy.service';
import { DEFAULT_FOLLOWUP_POLICY } from './types';
import { evaluateGuardSnapshot } from './followup-guard.service';

describe('detectStopIntent', () => {
  it('stops on explicit STOP / unsubscribe, case-insensitive', () => {
    expect(detectStopIntent('STOP')).toBe('stop');
    expect(detectStopIntent('unsubscribe')).toBe('stop');
    expect(detectStopIntent('Please stop')).toBe('stop');
  });

  it('stops on a short not-interested message', () => {
    expect(detectStopIntent('not interested')).toBe('negative');
  });

  it('does not stop a normal conversation that happens to use the words', () => {
    expect(
      detectStopIntent(
        'I am not interested in insurance, I want the Goa package price'
      )
    ).toBeNull();
    expect(detectStopIntent('please stop by the clinic tomorrow')).toBeNull();
  });
});

describe('follow-up policy', () => {
  it('defaults to one reminder inside 7 days', () => {
    expect(DEFAULT_FOLLOWUP_POLICY.maxReminders).toBe(1);
    expect(DEFAULT_FOLLOWUP_POLICY.reminderDelayDays).toBe(7);
    const due = reminderDueAt(new Date('2026-01-01T00:00:00.000Z'));
    expect(due.toISOString()).toBe('2026-01-08T00:00:00.000Z');
  });

  it('refuses a second reminder', () => {
    expect(
      canScheduleReminder({
        reminderCount: 1,
        hasScheduled: false,
      }).allowed
    ).toBe(false);
    expect(
      canScheduleReminder({
        reminderCount: 0,
        hasScheduled: true,
      }).reason
    ).toBe('pending_followup');
  });

  it('clamps invalid stored policy values', () => {
    const parsed = parseFollowupPolicy({
      max_reminders: 99,
      reminder_delay_days: 0,
      enabled: true,
    });
    expect(parsed.maxReminders).toBe(1);
    expect(parsed.reminderDelayDays).toBe(7);
  });
});

describe('evaluateGuardSnapshot', () => {
  it('cancels a stale reminder after the customer replies', () => {
    const decision = evaluateGuardSnapshot(
      { customerRepliedSince: true },
      { isReminder: true }
    );
    expect(decision).toEqual({ allow: false, reason: 'customer_replied' });
  });

  it('blocks after the maximum reminder has been sent', () => {
    expect(
      evaluateGuardSnapshot(
        { lead: { reminder_count: 1, followup_status: 'reminder_sent' } },
        { isReminder: true }
      ).reason
    ).toBe('max_reminders');
  });

  it('pauses when a human has taken over', () => {
    expect(
      evaluateGuardSnapshot({
        conversation: { assigned_agent_id: 'agent-1' },
      }).reason
    ).toBe('human_handoff');
  });

  it('stops for converted or lost leads', () => {
    expect(evaluateGuardSnapshot({ lead: { stage: 'CONVERTED' } }).reason).toBe(
      'lead_converted'
    );
    expect(evaluateGuardSnapshot({ lead: { stage: 'LOST' } }).reason).toBe(
      'lead_lost'
    );
  });

  it('stops for closed conversations, opt-out, and STOP', () => {
    expect(
      evaluateGuardSnapshot({
        conversation: { status: 'closed' },
      }).reason
    ).toBe('conversation_closed');
    expect(evaluateGuardSnapshot({ optedOut: true }).reason).toBe('opted_out');
    expect(evaluateGuardSnapshot({ latestCustomerText: 'STOP' }).reason).toBe(
      'stop_keyword'
    );
  });

  it('allows a healthy first reminder', () => {
    expect(
      evaluateGuardSnapshot(
        {
          conversation: { status: 'open', assigned_agent_id: null },
          lead: { stage: 'QUALIFYING', reminder_count: 0 },
          whatsappConnected: true,
        },
        { isReminder: true }
      )
    ).toEqual({ allow: true });
  });
});
