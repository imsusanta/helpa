import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/automations/admin-client';
import { authorizeCronRequest } from '@/lib/cron/security';
import {
  addDaysToDateKey,
  getDateKeyInTimeZone,
  getZonedDateParts,
  isValidTimeZone,
  isWithinBusinessHours,
  zonedDateTimeToUtc,
} from '@/lib/cron/timezone';
import { enqueueAppointmentReminder } from '@/queues/producers/appointment-reminders';

type ReminderBusinessHours = {
  enabled?: boolean;
  start?: string;
  end?: string;
};

type ReminderAccount = {
  id: string;
  name: string | null;
  timezone: string | null;
  reminder_enabled: boolean | null;
  reminder_24h_enabled: boolean | null;
  reminder_2h_enabled: boolean | null;
  reminder_business_hours: ReminderBusinessHours | null;
};

const NO_STORE_HEADERS = {
  'Cache-Control': 'private, no-store, no-cache, must-revalidate',
};

export async function GET(request: Request) {
  const authorization = authorizeCronRequest(request);
  if (!authorization.authorized) {
    return NextResponse.json(
      { error: authorization.message },
      { status: authorization.status, headers: NO_STORE_HEADERS }
    );
  }

  try {
    const db = supabaseAdmin();
    const now = new Date();
    const { data: accountRows, error: accountsError } = await db
      .from('accounts')
      .select('*');

    if (accountsError) throw new Error('Unable to load reminder settings');

    const accounts = (accountRows || []) as unknown as ReminderAccount[];
    let queued24h = 0;
    let queued2h = 0;
    let skipped = 0;
    let failed = 0;

    for (const account of accounts.filter((item) => item.reminder_enabled)) {
      const timeZone = account.timezone?.trim() || '';
      if (!isValidTimeZone(timeZone)) {
        failed++;
        console.error('[Cron Reminders] Invalid clinic timezone', {
          accountId: account.id,
        });
        continue;
      }

      const businessHours = account.reminder_business_hours || {};
      if (businessHours.enabled) {
        const nowParts = getZonedDateParts(now, timeZone);
        const currentMinutes = nowParts.hour * 60 + nowParts.minute;
        if (
          !businessHours.start ||
          !businessHours.end ||
          !isWithinBusinessHours(
            currentMinutes,
            businessHours.start,
            businessHours.end
          )
        ) {
          skipped++;
          continue;
        }
      }

      const today = getDateKeyInTimeZone(now, timeZone);
      const maxDate = addDaysToDateKey(today, 2);
      const { data: appointments, error: appointmentsError } = await db
        .from('appointments')
        .select(
          'id, account_id, appointment_date, appointment_time, status, reminder_24h_sent, reminder_2h_sent'
        )
        .eq('account_id', account.id)
        .in('status', [
          'pending',
          'Scheduled',
          'Reminder Sent',
          'pending-confirmation',
        ])
        .gte('appointment_date', today)
        .lte('appointment_date', maxDate);

      if (appointmentsError) {
        failed++;
        console.error('[Cron Reminders] Appointment query failed', {
          accountId: account.id,
        });
        continue;
      }

      for (const appointment of appointments || []) {
        try {
          if (!appointment.appointment_date || !appointment.appointment_time) {
            skipped++;
            continue;
          }

          const appointmentAt = zonedDateTimeToUtc(
            appointment.appointment_date,
            appointment.appointment_time,
            timeZone
          );
          const diffHours =
            (appointmentAt.getTime() - now.getTime()) / (60 * 60 * 1000);

          let reminderType: '24h' | '2h' | null = null;
          if (
            diffHours > 0 &&
            diffHours <= 2 &&
            !appointment.reminder_2h_sent &&
            account.reminder_2h_enabled
          ) {
            reminderType = '2h';
          } else if (
            diffHours > 2 &&
            diffHours <= 24 &&
            !appointment.reminder_24h_sent &&
            account.reminder_24h_enabled
          ) {
            reminderType = '24h';
          }

          if (!reminderType) {
            skipped++;
            continue;
          }

          await enqueueAppointmentReminder({
            accountId: account.id,
            appointmentId: appointment.id,
            reminderType,
          });

          if (reminderType === '24h') queued24h++;
          else queued2h++;
        } catch (error) {
          failed++;
          console.error('[Cron Reminders] Failed to enqueue appointment', {
            accountId: account.id,
            appointmentId: appointment.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    }

    return NextResponse.json(
      {
        success: true,
        queued_24h: queued24h,
        queued_2h: queued2h,
        skipped,
        failed,
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    console.error('[Cron Reminders] Scheduling failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(
      { error: 'Reminder scheduling failed' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
