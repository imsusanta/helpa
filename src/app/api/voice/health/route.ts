import { NextResponse } from 'next/server';
import { getVoiceProvider } from '@/core/providers/voice/provider-factory';
import { AppwriteVoiceOutboxWorker } from '@/lib/voice/voice-outbox-worker';
import { getAppwriteAdminClient } from '@/infrastructure/appwrite/server';
import { APPWRITE_CONFIG } from '@/infrastructure/appwrite/config';

export interface VoiceHealthResponse {
  configured: boolean;
  credentialsValid: boolean;
  providerReachable: boolean;
  webhookConfigured: boolean;
  agentFound: boolean;
  phoneNumberFound: boolean;
  schemaReady: boolean;
  workerReady: boolean;
  workerHeartbeatHealthy: boolean;
  queuedEventCount: number;
  deadLetterCount: number;
  lastSuccessfulWebhookAt: string | null;
  lastSuccessfulOutboundCallAt: string | null;
  commitSha: string;
  status:
    | 'not_configured'
    | 'misconfigured'
    | 'connected'
    | 'degraded'
    | 'unavailable';
  checkedAt: string;
}

export async function GET() {
  const commitSha =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.GITHUB_SHA ||
    process.env.APPWRITE_GIT_COMMIT_SHA ||
    process.env.NEXT_PUBLIC_APPWRITE_GIT_COMMIT_SHA ||
    '06048028b9c8cbba5696140dc3a1b57dae7ca4b0';

  const isConfigured = Boolean(process.env.ELEVENLABS_API_KEY);
  const hasWebhookSecret = Boolean(process.env.ELEVENLABS_WEBHOOK_SECRET);
  const hasAgentId = Boolean(process.env.ELEVENLABS_AGENT_ID);
  const hasPhoneNumberId = Boolean(process.env.ELEVENLABS_PHONE_NUMBER_ID);

  // 1. Verify Appwrite Required Collections and Storage Buckets exist
  let schemaReady = false;
  try {
    const db = getAppwriteAdminClient().databases;
    const storage = getAppwriteAdminClient().storage;

    await Promise.all([
      db.getCollection(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.calls
      ),
      db.getCollection(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.providerEvents
      ),
      db.getCollection(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.voiceCommands
      ),
      db.getCollection(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.voiceIntegrations
      ),
      db.getCollection(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.workerHealth
      ),
      storage.getBucket(APPWRITE_CONFIG.buckets.webhookPayloads),
    ]);
    schemaReady = true;
  } catch {
    schemaReady = false;
  }

  // 2. Query real provider health
  const provider = getVoiceProvider('elevenlabs');
  const baseHealth = await provider.healthCheck();

  // 3. Derive worker status from persistent Appwrite worker_health collection
  const outboxMetrics = await AppwriteVoiceOutboxWorker.getHealthMetrics();

  let status: VoiceHealthResponse['status'] = 'not_configured';

  if (!isConfigured) {
    status = 'not_configured';
  } else if (
    !hasWebhookSecret ||
    !hasAgentId ||
    !hasPhoneNumberId ||
    !schemaReady
  ) {
    status = 'misconfigured';
  } else if (baseHealth.providerReachable && baseHealth.credentialsValid) {
    status = outboxMetrics.workerReady ? 'connected' : 'degraded';
  } else if (baseHealth.configured) {
    status = 'degraded';
  } else {
    status = 'unavailable';
  }

  const response: VoiceHealthResponse = {
    configured: isConfigured,
    credentialsValid: baseHealth.credentialsValid,
    providerReachable: baseHealth.providerReachable,
    webhookConfigured: hasWebhookSecret,
    agentFound: baseHealth.agentFound,
    phoneNumberFound: baseHealth.phoneNumberFound,
    schemaReady,
    workerReady: outboxMetrics.workerReady,
    workerHeartbeatHealthy: outboxMetrics.workerHeartbeatHealthy,
    queuedEventCount: outboxMetrics.queuedCount,
    deadLetterCount: outboxMetrics.deadLetterCount,
    lastSuccessfulWebhookAt: null,
    lastSuccessfulOutboundCallAt: null,
    commitSha,
    status,
    checkedAt: new Date().toISOString(),
  };

  return NextResponse.json(response, {
    status: status === 'connected' || status === 'not_configured' ? 200 : 530,
    headers: { 'Cache-Control': 'private, no-store' },
  });
}
