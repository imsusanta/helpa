import { VoiceOutboxWorker } from '../src/lib/voice/voice-outbox-worker';
import { OutboxService } from '../src/lib/whatsapp/outbox-service';
import { processDueLeadFollowups } from '../src/lib/leads/lead-followup.service';
import { getAdminClient } from '../src/lib/db/server';

console.log('[Helpa Worker] Starting background worker...');

let isRunning = true;
const POLL_INTERVAL_MS = 5000;

async function runWorkerLoop() {
  while (isRunning) {
    try {
      // 1. Process WhatsApp outbound outbox reconciliation
      const reconciled = await OutboxService.reconcilePendingMessages();
      if (reconciled > 0) {
        console.log(
          `[Helpa Worker] Reconciled ${reconciled} pending outbound messages.`
        );
      }

      // 2. Process voice outbox & provider events
      await VoiceOutboxWorker.processPendingEvents();

      // 3. Drain due smart lead follow-ups (max 1 reminder / 7 days)
      const followups = await processDueLeadFollowups(getAdminClient(), {
        limit: 25,
      });
      if (followups.processed > 0) {
        console.log(
          `[Helpa Worker] Lead follow-ups processed=${followups.processed} sent=${followups.sent} skipped=${followups.skipped}`
        );
      }
    } catch (err) {
      console.error(
        '[Helpa Worker] Error during worker batch execution:',
        err instanceof Error ? err.message : String(err)
      );
    }

    if (isRunning) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  }
}

async function shutdown(signal: string) {
  console.log(`[Helpa Worker] ${signal} received; shutting down worker...`);
  isRunning = false;
  process.exit(0);
}

process.once('SIGTERM', () => void shutdown('SIGTERM'));
process.once('SIGINT', () => void shutdown('SIGINT'));

void runWorkerLoop();
console.log('[Helpa Worker] Worker loop active (5s poller).');
