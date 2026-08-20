import { appwriteAdmin } from '@/lib/appwrite-server-compat';

const DEFAULT_TIMEZONE = process.env.DEFAULT_TIMEZONE || 'Asia/Kolkata';

interface AppointmentReminderConfig {
  before_minutes?: number;
  timezone?: string;
}

interface AppointmentReminderInput {
  accountId: string;
  userId: string;
  contactId: string;
  appointmentId: string;
  appointmentDate: string;
  appointmentTime: string;
}

/** Schedule active appointment-reminder automations for a new appointment. */
export async function scheduleAppointmentReminders(
  input: AppointmentReminderInput
): Promise<void> {
  const db = appwriteAdmin();
  const { data: automations, error } = await db
    .from('automations')
    .select('*')
    .eq('account_id', input.accountId)
    .eq('trigger_type', 'appointment_reminder')
    .eq('is_active', true);

  if (error) {
    console.error('[automations] appointment reminder lookup failed:', error);
    return;
  }

  for (const automation of automations ?? []) {
    const config = (automation.trigger_config ?? {}) as AppointmentReminderConfig;
    const beforeMinutes = Number(config.before_minutes);
    if (!Number.isFinite(beforeMinutes) || beforeMinutes <= 0) {
      console.warn('[automations] invalid appointment reminder config:', automation.id);
      continue;
    }

    let runAt: Date;
    try {
      runAt = appointmentLocalToUtc(
        input.appointmentDate,
        input.appointmentTime,
        config.timezone || DEFAULT_TIMEZONE,
        beforeMinutes
      );
    } catch (err) {
      console.error('[automations] invalid appointment date/time:', err);
      continue;
    }

    const effectiveRunAt = runAt.getTime() <= Date.now() ? new Date() : runAt;

    // Idempotency guard: if the same appointment was already scheduled for
    // this automation, do not enqueue another pending reminder.
    const { data: existingPending, error: existingError } = await db
      .from('automation_pending_executions')
      .select('id')
      .eq('automation_id', automation.id)
      .eq('status', 'pending')
      .filter('context->>appointment_id', 'eq', input.appointmentId)
      .limit(1);

    if (existingError) {
      console.error('[automations] duplicate reminder lookup failed:', existingError);
      continue;
    }
    if (existingPending && existingPending.length > 0) {
      console.info('[automations] reminder already scheduled:', automation.id, input.appointmentId);
      continue;
    }

    const { data: log, error: logError } = await db
      .from('automation_logs')
      .insert({
        automation_id: automation.id,
        account_id: automation.account_id,
        user_id: automation.user_id,
        contact_id: input.contactId,
        trigger_event: 'appointment_reminder',
        steps_executed: [],
        status: 'success',
      })
      .select('id')
      .single();

    if (logError || !log) {
      console.error('[automations] reminder log creation failed:', logError);
      continue;
    }

    const { error: pendingError } = await db
      .from('automation_pending_executions')
      .insert({
        automation_id: automation.id,
        account_id: input.accountId,
        user_id: automation.user_id ?? input.userId,
        contact_id: input.contactId,
        log_id: log.id,
        parent_step_id: null,
        branch: null,
        next_step_position: 0,
        context: {
          appointment_id: input.appointmentId,
          appointment_date: input.appointmentDate,
          appointment_time: input.appointmentTime,
          reminder_before_minutes: beforeMinutes,
        },
        run_at: effectiveRunAt.toISOString(),
        status: 'pending',
      });

    if (pendingError) {
      console.error('[automations] reminder scheduling failed:', pendingError);
    }
  }
}

/** Convert business-local appointment date/time to UTC and subtract N minutes. */
export function appointmentLocalToUtc(
  date: string,
  time: string,
  timeZone: string,
  beforeMinutes: number
): Date {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute = 0] = time.split(':').map(Number);
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    throw new Error('Invalid appointment date/time');
  }

  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const offsetMinutes = getTimezoneOffsetMinutes(guess, timeZone);
  return new Date(
    guess.getTime() - offsetMinutes * 60_000 - beforeMinutes * 60_000
  );
}

function getTimezoneOffsetMinutes(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.filter((p) => p.type !== 'literal').map((p) => [p.type, p.value])
  );
  const asUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second)
  );
  return (asUtc - date.getTime()) / 60_000;
}
