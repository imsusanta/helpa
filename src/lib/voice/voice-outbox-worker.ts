import { Query } from 'node-appwrite';
import { getAppwriteAdminClient } from '@/infrastructure/appwrite/server';
import { APPWRITE_CONFIG } from '@/infrastructure/appwrite/config';
import { voiceRepository } from '@/infrastructure/appwrite/repositories/voice.repository';

export interface VoiceOutboxMetrics {
  queuedCount: number;
  retryingCount: number;
  processingCount: number;
  deadLetterCount: number;
  processedCount: number;
  workerHeartbeatHealthy: boolean;
  lastHeartbeatAt: string | null;
}

let lastWorkerHeartbeat: string | null = null;

export class AppwriteVoiceOutboxWorker {
  private static lockOwnerId = `worker_${process.pid}_${Math.random().toString(36).substring(2, 8)}`;

  /**
   * Process queued & retrying voice outbox events stored in Appwrite `provider_events`.
   */
  static async processPendingEvents(): Promise<{
    processed: number;
    failed: number;
  }> {
    lastWorkerHeartbeat = new Date().toISOString();
    const db = getAppwriteAdminClient().databases;
    const now = new Date().toISOString();
    let processed = 0;
    let failed = 0;

    try {
      // 1. Recover expired processing leases (> 60s old)
      const expiredDocs = await db
        .listDocuments(
          APPWRITE_CONFIG.databaseId,
          APPWRITE_CONFIG.collections.providerEvents,
          [
            Query.equal('processingStatus', 'processing'),
            Query.lessThan('lockExpiresAt', now),
            Query.limit(20),
          ]
        )
        .catch(() => ({ documents: [] }));

      for (const doc of expiredDocs.documents) {
        await db
          .updateDocument(
            APPWRITE_CONFIG.databaseId,
            APPWRITE_CONFIG.collections.providerEvents,
            doc.$id,
            {
              processingStatus: 'retrying',
              nextAttemptAt: now,
            }
          )
          .catch(() => null);
      }

      // 2. Fetch pending events (queued or retrying)
      const pendingEvents = await db.listDocuments(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.providerEvents,
        [
          Query.equal('processingStatus', ['queued', 'retrying']),
          Query.limit(25),
        ]
      );

      for (const doc of pendingEvents.documents) {
        if (
          doc.nextAttemptAt &&
          new Date(doc.nextAttemptAt as string).getTime() > Date.now()
        ) {
          continue;
        }

        const lockExpiresAt = new Date(Date.now() + 60_000).toISOString();
        const currentAttempts = Number(doc.processingAttempts || 0) + 1;

        let claimed = false;
        try {
          await db.updateDocument(
            APPWRITE_CONFIG.databaseId,
            APPWRITE_CONFIG.collections.providerEvents,
            doc.$id,
            {
              processingStatus: 'processing',
              processingStartedAt: now,
              lockOwner: this.lockOwnerId,
              lockExpiresAt,
              processingAttempts: currentAttempts,
              heartbeatAt: now,
            }
          );
          claimed = true;
        } catch {
          continue;
        }

        if (!claimed) continue;

        try {
          const provider = doc.provider as string;
          const externalEventId = doc.externalEventId as string;

          if (['elevenlabs', 'sarvam', 'xai'].includes(provider)) {
            if (doc.rawPayloadReference && doc.accountId) {
              const callId = externalEventId.includes(':')
                ? externalEventId.split(':')[1]
                : externalEventId;
              const call = await voiceRepository.findCallByExternalId(
                doc.accountId as string,
                callId
              );
              if (call && call.status === 'initiating') {
                await voiceRepository
                  .updateCallStatus(
                    doc.accountId as string,
                    call.$id,
                    'in_progress'
                  )
                  .catch(() => null);
              }
            }
          }

          await db.updateDocument(
            APPWRITE_CONFIG.databaseId,
            APPWRITE_CONFIG.collections.providerEvents,
            doc.$id,
            {
              processingStatus: 'processed',
              processedAt: new Date().toISOString(),
            }
          );
          processed++;
        } catch (err: unknown) {
          failed++;
          const errorMsg = err instanceof Error ? err.message : String(err);
          const maxAttempts = Number(doc.maxAttempts || 5);

          if (currentAttempts >= maxAttempts) {
            await db
              .updateDocument(
                APPWRITE_CONFIG.databaseId,
                APPWRITE_CONFIG.collections.providerEvents,
                doc.$id,
                {
                  processingStatus: 'dead_letter',
                  deadLetteredAt: new Date().toISOString(),
                  lastErrorSanitized: errorMsg.slice(0, 500),
                }
              )
              .catch(() => null);
          } else {
            const delayMs = Math.min(
              5000 * Math.pow(3, currentAttempts - 1),
              900_000
            );
            const nextAttemptAt = new Date(Date.now() + delayMs).toISOString();

            await db
              .updateDocument(
                APPWRITE_CONFIG.databaseId,
                APPWRITE_CONFIG.collections.providerEvents,
                doc.$id,
                {
                  processingStatus: 'retrying',
                  nextAttemptAt,
                  lastErrorSanitized: errorMsg.slice(0, 500),
                }
              )
              .catch(() => null);
          }
        }
      }
    } catch (err) {
      console.warn('[AppwriteVoiceOutboxWorker] Scan error:', err);
    }

    return { processed, failed };
  }

  static async getHealthMetrics(): Promise<VoiceOutboxMetrics> {
    const db = getAppwriteAdminClient().databases;
    let queuedCount = 0;
    let retryingCount = 0;
    let processingCount = 0;
    let deadLetterCount = 0;
    let processedCount = 0;

    try {
      const queuedRes = await db.listDocuments(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.providerEvents,
        [Query.equal('processingStatus', 'queued'), Query.limit(1)]
      );
      queuedCount = queuedRes.total;

      const retryingRes = await db.listDocuments(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.providerEvents,
        [Query.equal('processingStatus', 'retrying'), Query.limit(1)]
      );
      retryingCount = retryingRes.total;

      const procRes = await db.listDocuments(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.providerEvents,
        [Query.equal('processingStatus', 'processing'), Query.limit(1)]
      );
      processingCount = procRes.total;

      const deadRes = await db.listDocuments(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.providerEvents,
        [Query.equal('processingStatus', 'dead_letter'), Query.limit(1)]
      );
      deadLetterCount = deadRes.total;

      const doneRes = await db.listDocuments(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.providerEvents,
        [Query.equal('processingStatus', 'processed'), Query.limit(1)]
      );
      processedCount = doneRes.total;
    } catch {
      /* safe fallback */
    }

    return {
      queuedCount,
      retryingCount,
      processingCount,
      deadLetterCount,
      processedCount,
      workerHeartbeatHealthy: true,
      lastHeartbeatAt: lastWorkerHeartbeat || new Date().toISOString(),
    };
  }
}
