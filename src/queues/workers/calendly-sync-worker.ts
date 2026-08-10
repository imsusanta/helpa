import { Job } from 'bullmq';
import { DefaultCalendlyProvider } from '@/core/providers/calendly/calendly-provider';
import { supabaseAdmin } from '@/lib/automations/admin-client';

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

  const db = supabaseAdmin();
  await db
    .from('calendly_connections')
    .update({
      last_synced_at: new Date().toISOString(),
    })
    .eq('account_id', accountId);
}
