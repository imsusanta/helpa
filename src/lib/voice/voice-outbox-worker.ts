import crypto from 'node:crypto';
import { Query } from 'node-appwrite';
import { getAppwriteAdminClient } from '@/infrastructure/appwrite/server';
import { APPWRITE_CONFIG } from '@/infrastructure/appwrite/config';
import { voiceRepository } from '@/infrastructure/appwrite/repositories/voice.repository';
import { resolveTenantVoiceConfig } from '@/core/providers/voice/credential-resolver';
import { getVoiceProvider } from '@/core/providers/voice/provider-factory';
import { VoiceProviderError } from '@/core/providers/voice/voice-provider.interface';

export interface VoiceOutboxMetrics {
  queuedCount: number;
  retryingCount: number;
  processingCount: number;
  deadLetterCount: number;
  processedCount: number;
  workerReady: boolean;
  workerHeartbeatHealthy: boolean;
  lastHeartbeatAt: string | null;
}

const COMMIT_SHA =
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.GITHUB_SHA ||
  process.env.APPWRITE_GIT_COMMIT_SHA ||
  '06048028b9c8cbba5696140dc3a1b57dae7ca4b0';

const WORKER_ID = `voice_worker_primary`;
const HEARTBEAT_FRESHNESS_MS = 120_000;

export class AppwriteVoiceOutboxWorker {
  private static startedAt = new Date().toISOString();
  private static processedCount = 0;
  private static retryCount = 0;
  private static deadLetterCount = 0;
  private static lastSuccessAt: string | null = null;
  private static lastFailureCode: string | null = null;

  /**
   * Persists heartbeat in Appwrite `worker_health` collection.
   */
  static async recordHeartbeat(): Promise<void> {
    const db = getAppwriteAdminClient().databases;
    const now = new Date().toISOString();

    try {
      const existing = await db.listDocuments(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.workerHealth,
        [Query.equal('workerId', WORKER_ID), Query.limit(1)]
      );

      if (existing.documents[0]) {
        await db.updateDocument(
          APPWRITE_CONFIG.databaseId,
          APPWRITE_CONFIG.collections.workerHealth,
          existing.documents[0].$id,
          {
            commitSha: COMMIT_SHA,
            lastHeartbeatAt: now,
            lastScanAt: now,
            lastSuccessAt: this.lastSuccessAt,
            lastFailureCode: this.lastFailureCode,
            processedCount: this.processedCount,
            retryCount: this.retryCount,
            deadLetterCount: this.deadLetterCount,
            updatedAt: now,
          }
        );
      } else {
        await db.createDocument(
          APPWRITE_CONFIG.databaseId,
          APPWRITE_CONFIG.collections.workerHealth,
          WORKER_ID,
          {
            workerId: WORKER_ID,
            commitSha: COMMIT_SHA,
            startedAt: this.startedAt,
            lastHeartbeatAt: now,
            lastScanAt: now,
            lastSuccessAt: this.lastSuccessAt,
            lastFailureCode: this.lastFailureCode,
            processedCount: this.processedCount,
            retryCount: this.retryCount,
            deadLetterCount: this.deadLetterCount,
            updatedAt: now,
          }
        );
      }
    } catch {
      /* safe heartbeat logging */
    }
  }

  /**
   * Process pending outbox events stored in `provider_events`.
   */
  static async processPendingEvents(): Promise<{
    processed: number;
    failed: number;
  }> {
    const db = getAppwriteAdminClient().databases;
    const storage = getAppwriteAdminClient().storage;
    const now = new Date().toISOString();
    let processed = 0;
    let failed = 0;

    await this.recordHeartbeat();

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

        // Atomically claim event lock
        let claimed = false;
        try {
          await db.updateDocument(
            APPWRITE_CONFIG.databaseId,
            APPWRITE_CONFIG.collections.providerEvents,
            doc.$id,
            {
              processingStatus: 'processing',
              processingStartedAt: now,
              lockOwner: WORKER_ID,
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

        // Re-read document to verify lock ownership before side effects
        const verifyDoc = await db
          .getDocument(
            APPWRITE_CONFIG.databaseId,
            APPWRITE_CONFIG.collections.providerEvents,
            doc.$id
          )
          .catch(() => null);

        if (!verifyDoc || verifyDoc.lockOwner !== WORKER_ID) {
          continue; // Lock stolen or lost
        }

        try {
          const providerName = doc.provider as 'elevenlabs' | 'sarvam' | 'xai';
          const externalEventId = doc.externalEventId as string;
          const accountId = doc.accountId as string;
          const rawPayloadReference = doc.rawPayloadReference as string;
          const expectedHash = doc.payloadHash as string;

          if (!accountId || !rawPayloadReference) {
            throw new VoiceProviderError(
              'VOICE_PROVIDER_REQUEST_FAILED',
              'Event document is missing required tenant or payload references',
              400
            );
          }

          // Download raw payload from private Appwrite Storage
          const fileBuffer = await storage.getFileDownload(
            APPWRITE_CONFIG.buckets.webhookPayloads,
            rawPayloadReference
          );
          const rawBody = Buffer.from(fileBuffer).toString('utf8');

          // Verify SHA-256 payload hash integrity
          const computedHash = crypto
            .createHash('sha256')
            .update(rawBody)
            .digest('hex');

          if (computedHash !== expectedHash) {
            throw new VoiceProviderError(
              'VOICE_PROVIDER_REQUEST_FAILED',
              'Raw payload SHA-256 hash mismatch',
              400
            );
          }

          // Resolve tenant configuration & reconstruct provider
          const tenantConfig = await resolveTenantVoiceConfig(
            accountId,
            providerName
          );
          const provider = getVoiceProvider(providerName, tenantConfig);

          // Normalize stored event payload
          const event = await provider.normalizeWebhook(rawBody);

          if (event.externalEventId !== externalEventId) {
            throw new VoiceProviderError(
              'VOICE_PROVIDER_REQUEST_FAILED',
              'Normalized event ID mismatch',
              400
            );
          }

          // Apply call status update via state-machine-enforced repository method
          if (event.status) {
            await voiceRepository.upsertCall(accountId, event.externalCallId, {
              provider: providerName,
              direction: event.direction || 'outbound',
              status: event.status,
              agentId: event.externalAgentId,
              startedAt: event.startedAt,
              endedAt: event.endedAt,
              durationSeconds: event.durationSeconds,
              transcriptStatus: event.transcript ? 'available' : 'pending',
              failureCode: event.failureCode,
              failureMessageSanitized: event.failureMessageSanitized,
            });
          }

          // Mark event processed
          await db.updateDocument(
            APPWRITE_CONFIG.databaseId,
            APPWRITE_CONFIG.collections.providerEvents,
            doc.$id,
            {
              processingStatus: 'processed',
              processedAt: new Date().toISOString(),
            }
          );

          this.processedCount++;
          this.lastSuccessAt = new Date().toISOString();
          processed++;
        } catch (err: unknown) {
          failed++;
          this.retryCount++;
          const errorCode =
            err instanceof VoiceProviderError
              ? err.code
              : 'VOICE_PROVIDER_REQUEST_FAILED';
          this.lastFailureCode = errorCode;

          const maxAttempts = Number(doc.maxAttempts || 5);

          if (currentAttempts >= maxAttempts) {
            this.deadLetterCount++;
            await db
              .updateDocument(
                APPWRITE_CONFIG.databaseId,
                APPWRITE_CONFIG.collections.providerEvents,
                doc.$id,
                {
                  processingStatus: 'dead_letter',
                  deadLetteredAt: new Date().toISOString(),
                  lastErrorSanitized: errorCode,
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
                  lastErrorSanitized: errorCode,
                }
              )
              .catch(() => null);
          }
        }
      }
    } catch (err) {
      console.warn('[AppwriteVoiceOutboxWorker] Outbox scan error:', err);
    }

    await this.recordHeartbeat();
    return { processed, failed };
  }

  /**
   * Reads persistent worker metrics from `worker_health` collection.
   */
  static async getHealthMetrics(): Promise<VoiceOutboxMetrics> {
    const db = getAppwriteAdminClient().databases;
    let queuedCount = 0;
    let retryingCount = 0;
    let processingCount = 0;
    let deadLetterCount = 0;
    let processedCount = 0;

    let workerReady = false;
    let workerHeartbeatHealthy = false;
    let lastHeartbeatAt: string | null = null;

    try {
      const workerDocs = await db.listDocuments(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.workerHealth,
        [Query.equal('workerId', WORKER_ID), Query.limit(1)]
      );

      if (workerDocs.documents[0]) {
        const workerDoc = workerDocs.documents[0];
        lastHeartbeatAt = (workerDoc.lastHeartbeatAt as string) || null;
        if (lastHeartbeatAt) {
          const age = Date.now() - new Date(lastHeartbeatAt).getTime();
          if (age <= HEARTBEAT_FRESHNESS_MS) {
            workerReady = true;
            workerHeartbeatHealthy = true;
          }
        }
      }

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
      workerReady,
      workerHeartbeatHealthy,
      lastHeartbeatAt,
    };
  }
}
