/* eslint-disable @typescript-eslint/no-explicit-any */
import { Queue } from 'bullmq';
import Redis from 'ioredis';

export const PROVIDER_EVENTS_QUEUE = 'provider-events';

export interface ProviderEventJobPayload {
  documentId: string;
  provider: string;
  externalEventId: string;
  eventType: string;
  rawPayloadReference?: string;
  accountId?: string;
}

let redisConnection: Redis | null = null;
let providerEventsQueue: Queue<ProviderEventJobPayload> | null = null;

function getProviderEventsQueue(): Queue<ProviderEventJobPayload> | null {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null;

  try {
    if (!redisConnection) {
      redisConnection = new Redis(redisUrl, {
        lazyConnect: true,
        maxRetriesPerRequest: null,
      });
    }
    if (!providerEventsQueue) {
      providerEventsQueue = new Queue<ProviderEventJobPayload>(
        PROVIDER_EVENTS_QUEUE,
        {
          connection: redisConnection as any,
          defaultJobOptions: {
            attempts: 5,
            backoff: { type: 'exponential', delay: 10_000 },
            removeOnComplete: { age: 7 * 24 * 60 * 60, count: 50_000 },
            removeOnFail: { age: 30 * 24 * 60 * 60, count: 50_000 },
          },
        }
      );
    }
    return providerEventsQueue;
  } catch (err) {
    console.warn(
      '[ProviderEventsProducer] Redis connection unavailable:',
      err instanceof Error ? err.message : String(err)
    );
    return null;
  }
}

export async function enqueueProviderEventJob(
  payload: ProviderEventJobPayload
): Promise<boolean> {
  const queue = getProviderEventsQueue();
  if (!queue) return false;

  try {
    const jobId = `pe_${payload.provider}_${payload.externalEventId.replace(/[^a-zA-Z0-9_.-]/g, '_')}`;
    await queue.add('process-event', payload, { jobId });
    return true;
  } catch (err) {
    console.warn(
      '[ProviderEventsProducer] Failed to enqueue job to BullMQ queue:',
      err instanceof Error ? err.message : String(err)
    );
    return false;
  }
}
