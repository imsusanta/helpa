import { Queue } from 'bullmq';
import Redis from 'ioredis';

export const FOLLOWUPS_QUEUE = 'followups';
export const APPOINTMENT_REMINDER_JOB = 'appointment-reminder';

export interface AppointmentReminderJobData {
  accountId: string;
  appointmentId: string;
  reminderType: '24h' | '2h';
}

let redisConnection: Redis | null = null;
let followupsQueue: Queue<AppointmentReminderJobData> | null = null;

function getFollowupsQueue(): Queue<AppointmentReminderJobData> {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error('REDIS_URL is not configured');

  if (!redisConnection) {
    redisConnection = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: null,
    });
  }
  if (!followupsQueue) {
    followupsQueue = new Queue<AppointmentReminderJobData>(FOLLOWUPS_QUEUE, {
      connection: redisConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 30_000 },
        removeOnComplete: { age: 30 * 24 * 60 * 60, count: 10_000 },
        removeOnFail: { age: 30 * 24 * 60 * 60, count: 10_000 },
      },
    });
  }
  return followupsQueue;
}

export async function enqueueAppointmentReminder(
  data: AppointmentReminderJobData
): Promise<string> {
  const queue = getFollowupsQueue();
  const jobId = `appointment-reminder-${data.appointmentId}-${data.reminderType}`;
  const job = await queue.add(APPOINTMENT_REMINDER_JOB, data, { jobId });
  return String(job.id);
}
