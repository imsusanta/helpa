import { Job } from 'bullmq';
import { DefaultCalendlyProvider } from '@/core/providers/calendly/calendly-provider';

export interface CalendlySyncJobData {
  accountId: string;
}

export async function processCalendlySyncJob(job: Job<CalendlySyncJobData>) {
  const { accountId } = job.data;
  console.log(
    `[Worker: calendly-sync] Syncing event types and bookings for account ${accountId}`
  );

  const provider = new DefaultCalendlyProvider();
  await provider.listEventTypes(accountId);
}
