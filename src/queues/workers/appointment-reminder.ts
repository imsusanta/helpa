import { Job, UnrecoverableError } from 'bullmq';
import { appointmentsRepository } from '@/infrastructure/appwrite/repositories/appointments.repository';
import {
  APPOINTMENT_REMINDER_JOB,
  type AppointmentReminderJobData,
} from '@/queues/producers/appointment-reminders';

export async function processFollowupJob(
  job: Job<AppointmentReminderJobData>
): Promise<void> {
  if (job.name !== APPOINTMENT_REMINDER_JOB) {
    console.warn('[Worker: followups] Ignoring unsupported job', {
      jobId: job.id,
      jobName: job.name,
    });
    return;
  }

  const { accountId, appointmentId, reminderType } = job.data;
  if (!accountId || !appointmentId || !['24h', '2h'].includes(reminderType)) {
    throw new UnrecoverableError('Invalid appointment reminder job');
  }

  const appointment = await appointmentsRepository.getAppointment(
    accountId,
    appointmentId
  );

  if (!appointment) return;

  await appointmentsRepository.updateAppointment(accountId, appointmentId, {
    status: 'completed',
  });
}
