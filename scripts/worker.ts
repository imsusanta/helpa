import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const connection = new Redis(redisUrl, { maxRetriesPerRequest: null });

console.log('[Helpa Worker] Starting background worker queues...');

// 1. Provider Events Queue Worker
new Worker(
  'provider-events',
  async (job: Job) => {
    console.log(
      `[Worker: provider-events] Processing job ${job.id}:`,
      job.name
    );
  },
  { connection }
);

// 2. Outbound WhatsApp Queue Worker
new Worker(
  'outbound-whatsapp',
  async (job: Job) => {
    console.log(
      `[Worker: outbound-whatsapp] Dispatching message job ${job.id}`
    );
  },
  { connection }
);

// 3. Outbound SMS Queue Worker
new Worker(
  'outbound-sms',
  async (job: Job) => {
    console.log(`[Worker: outbound-sms] Dispatching SMS job ${job.id}`);
  },
  { connection }
);

// 4. Outbound Voice Queue Worker
new Worker(
  'outbound-voice',
  async (job: Job) => {
    console.log(`[Worker: outbound-voice] Initiating call job ${job.id}`);
  },
  { connection }
);

// 5. Followups Queue Worker
new Worker(
  'followups',
  async (job: Job) => {
    console.log(`[Worker: followups] Executing sequence step job ${job.id}`);
  },
  { connection }
);

// 6. Calendly Sync Queue Worker
new Worker(
  'calendly-sync',
  async (job: Job) => {
    console.log(`[Worker: calendly-sync] Synchronizing event job ${job.id}`);
  },
  { connection }
);

console.log(
  '[Helpa Worker] All 6 worker queues initialized and listening for jobs.'
);
