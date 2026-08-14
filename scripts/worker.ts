import { AppwriteVoiceOutboxWorker } from '../src/lib/voice/voice-outbox-worker';

console.log('[Helpa Worker] Starting Appwrite-native background worker...');

let isRunning = true;
const POLL_INTERVAL_MS = 5000;

async function runWorkerLoop() {
  while (isRunning) {
    try {
      // 1. Process voice outbox & provider events
      await AppwriteVoiceOutboxWorker.processPendingEvents();
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
console.log('[Helpa Worker] Appwrite worker loop active.');
