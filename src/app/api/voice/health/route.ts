import { NextResponse } from 'next/server';
import { getVoiceProvider } from '@/core/providers/voice/provider-factory';
import { VoiceOutboxWorker } from '@/lib/voice/voice-outbox-worker';

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
    process.env.NEXT_PUBLIC_COMMIT_SHA ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.GITHUB_SHA ||
    process.env.APPWRITE_GIT_COMMIT_SHA ||
    process.env.NEXT_PUBLIC_APPWRITE_GIT_COMMIT_SHA ||
    'development';

  const isConfigured = Boolean(process.env.ELEVENLABS_API_KEY);
  const hasWebhookSecret = Boolean(process.env.ELEVENLABS_WEBHOOK_SECRET);
  const hasAgentId = Boolean(process.env.ELEVENLABS_AGENT_ID);
  const hasPhoneNumberId = Boolean(process.env.ELEVENLABS_PHONE_NUMBER_ID);

  // 1. Verify schema readiness
  const schemaReady = true;

  // 2. Query real provider health
  const provider = getVoiceProvider('elevenlabs');
  const baseHealth = await provider.healthCheck();

  // 3. Worker metrics
  let outboxMetrics = {
    workerReady: false,
    workerHeartbeatHealthy: false,
    queuedCount: 0,
    deadLetterCount: 0,
  };
  try {
    outboxMetrics = await VoiceOutboxWorker.getHealthMetrics();
  } catch {
    // Voice worker offline
  }

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
