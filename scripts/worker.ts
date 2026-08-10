/* eslint-disable @typescript-eslint/no-explicit-any */
import { Worker } from 'bullmq';
import Redis from 'ioredis';
import { processFollowupJob } from '../src/queues/workers/appointment-reminder';
import {
  processOutboundWhatsAppJob,
  processOutboundSmsJob,
  processOutboundVoiceJob,
  processProviderEventsJob,
} from '../src/queues/workers/multichannel-followup';
import { processCalendlySyncJob } from '../src/queues/workers/calendly-sync-worker';
import type { AppointmentReminderJobData } from '../src/queues/producers/appointment-reminders';

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) throw new Error('REDIS_URL is required to start the worker');

const connection = new Redis(redisUrl, { maxRetriesPerRequest: null });
console.log('[Helpa Worker] Starting background worker queues...');

const workers: Worker[] = [
  new Worker('provider-events', processProviderEventsJob, {
    connection: connection as any,
  }),
  new Worker('outbound-whatsapp', processOutboundWhatsAppJob, {
    connection: connection as any,
    concurrency: 3,
  }),
  new Worker('outbound-sms', processOutboundSmsJob, {
    connection: connection as any,
    concurrency: 3,
  }),
  new Worker('outbound-voice', processOutboundVoiceJob, {
    connection: connection as any,
    concurrency: 2,
  }),
  new Worker<AppointmentReminderJobData>('followups', processFollowupJob, {
    connection: connection as any,
    concurrency: 5,
  }),
  new Worker('calendly-sync', processCalendlySyncJob, {
    connection: connection as any,
  }),
];

for (const worker of workers) {
  worker.on('failed', (job, error) => {
    console.error('[Helpa Worker] Job failed', {
      queue: worker.name,
      jobId: job?.id,
      jobName: job?.name,
      attempt: job?.attemptsMade,
      error: error.message,
    });
  });
  worker.on('error', (error) => {
    console.error('[Helpa Worker] Worker error', {
      queue: worker.name,
      error: error.message,
    });
  });
}

async function shutdown(signal: string) {
  console.log(`[Helpa Worker] ${signal} received; closing workers...`);
  await Promise.all(workers.map((worker) => worker.close()));
  await connection.quit();
  process.exit(0);
}

process.once('SIGTERM', () => void shutdown('SIGTERM'));
process.once('SIGINT', () => void shutdown('SIGINT'));

console.log('[Helpa Worker] All 6 worker queues initialized.');
