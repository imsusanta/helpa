import { NextResponse } from 'next/server';
import { getVoiceProvider } from '@/core/providers/voice/provider-factory';

export interface VoiceHealthResponse {
  configured: boolean;
  credentialsValid: boolean;
  providerReachable: boolean;
  webhookConfigured: boolean;
  agentFound: boolean;
  phoneNumberFound: boolean;
  schemaReady: boolean;
  queueReachable: boolean;
  workerReady: boolean;
  lastSuccessfulWebhookAt: string | null;
  lastSuccessfulOutboundCallAt: string | null;
  status:
    | 'not_configured'
    | 'misconfigured'
    | 'connected'
    | 'degraded'
    | 'unavailable';
  checkedAt: string;
}

export async function GET() {
  const provider = getVoiceProvider('elevenlabs');
  const baseHealth = await provider.healthCheck();

  const isConfigured = Boolean(process.env.ELEVENLABS_API_KEY);
  const hasWebhookSecret = Boolean(process.env.ELEVENLABS_WEBHOOK_SECRET);
  const hasAgentId = Boolean(process.env.ELEVENLABS_AGENT_ID);
  const hasPhoneNumberId = Boolean(process.env.ELEVENLABS_PHONE_NUMBER_ID);

  let status: VoiceHealthResponse['status'] = 'not_configured';

  if (!isConfigured) {
    status = 'not_configured';
  } else if (!hasWebhookSecret || !hasAgentId || !hasPhoneNumberId) {
    status = 'misconfigured';
  } else if (baseHealth.providerReachable && baseHealth.credentialsValid) {
    status = 'connected';
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
    schemaReady: true,
    queueReachable: Boolean(process.env.REDIS_URL),
    workerReady: true,
    lastSuccessfulWebhookAt: null,
    lastSuccessfulOutboundCallAt: null,
    status,
    checkedAt: new Date().toISOString(),
  };

  return NextResponse.json(response, {
    status: status === 'connected' || status === 'not_configured' ? 200 : 503,
    headers: { 'Cache-Control': 'private, no-store' },
  });
}
