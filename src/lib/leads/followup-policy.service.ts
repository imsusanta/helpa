/**
 * Default smart follow-up policy.
 *
 * Initial response: immediately (handled by existing AI / automations).
 * If the customer does not reply: at most one reminder inside the
 * configured window (default 7 days). After that reminder, stop.
 */
import {
  DEFAULT_FOLLOWUP_POLICY,
  type FollowupPolicy,
} from '@/lib/leads/types';

export function parseFollowupPolicy(raw: unknown): FollowupPolicy {
  const row =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const maxReminders = Number(row.max_reminders ?? row.maxReminders);
  const reminderDelayDays = Number(
    row.reminder_delay_days ?? row.reminderDelayDays
  );
  return {
    enabled: row.enabled !== false,
    maxReminders:
      Number.isFinite(maxReminders) && maxReminders >= 0 && maxReminders <= 3
        ? Math.floor(maxReminders)
        : DEFAULT_FOLLOWUP_POLICY.maxReminders,
    reminderDelayDays:
      Number.isFinite(reminderDelayDays) &&
      reminderDelayDays >= 1 &&
      reminderDelayDays <= 30
        ? Math.floor(reminderDelayDays)
        : DEFAULT_FOLLOWUP_POLICY.reminderDelayDays,
  };
}

export function reminderDueAt(
  from: Date,
  policy: FollowupPolicy = DEFAULT_FOLLOWUP_POLICY
): Date {
  const days = Math.max(1, policy.reminderDelayDays);
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}

export function canScheduleReminder(input: {
  policy?: FollowupPolicy;
  reminderCount: number;
  hasScheduled: boolean;
  followupStatus?: string | null;
}): { allowed: boolean; reason?: string } {
  const policy = input.policy || DEFAULT_FOLLOWUP_POLICY;
  if (!policy.enabled) return { allowed: false, reason: 'policy_disabled' };
  if (policy.maxReminders <= 0)
    return { allowed: false, reason: 'max_reminders' };
  if (input.hasScheduled) return { allowed: false, reason: 'pending_followup' };
  if (input.reminderCount >= policy.maxReminders) {
    return { allowed: false, reason: 'max_reminders' };
  }
  if (
    input.followupStatus === 'stopped' ||
    input.followupStatus === 'human_takeover' ||
    input.followupStatus === 'reminder_sent'
  ) {
    return { allowed: false, reason: input.followupStatus };
  }
  return { allowed: true };
}

export { DEFAULT_FOLLOWUP_POLICY };
