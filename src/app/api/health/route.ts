import { NextResponse } from 'next/server';
import { APPWRITE_CONFIG } from '@/infrastructure/appwrite/config';
import { getAppwriteAdminClient } from '@/infrastructure/appwrite/server';
import { getVoiceProvider } from '@/core/providers/voice/provider-factory';

export async function GET(request: Request) {
  const timestamp = new Date().toISOString();
  const { pathname } = new URL(request.url);

  const commitSha =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.GITHUB_SHA ||
    process.env.APPWRITE_GIT_COMMIT_SHA ||
    process.env.NEXT_PUBLIC_APPWRITE_GIT_COMMIT_SHA ||
    'cf5425fc6be8ddceeb6bc350953a8093755ac977';

  // /api/health/live - Liveness Probe (Lightweight check)
  if (pathname.endsWith('/live')) {
    return NextResponse.json(
      { status: 'ok', timestamp, commit: commitSha },
      { status: 200, headers: { 'Cache-Control': 'no-store, private' } }
    );
  }

  // /api/health or /api/health/ready - Active Readiness Probe
  let appwriteReachable = false;
  let databaseHealthy = false;
  let latencyMs = 0;

  const startTime = Date.now();
  try {
    // 1. Active Appwrite Cloud ping
    const pingRes = await fetch(`${APPWRITE_CONFIG.endpoint}/health/version`, {
      headers: { 'X-Appwrite-Project': APPWRITE_CONFIG.projectId },
      cache: 'no-store',
      signal: AbortSignal.timeout(1500),
    }).catch(() => null);

    if (pingRes && pingRes.ok) {
      appwriteReachable = true;
    }

    // 2. Active Database ping
    try {
      const admin = getAppwriteAdminClient();
      await admin.databases.listCollections(APPWRITE_CONFIG.databaseId);
      databaseHealthy = true;
    } catch {
      // DB ping failed
    }

    latencyMs = Date.now() - startTime;
  } catch {
    latencyMs = Date.now() - startTime;
  }

  const isHealthy = appwriteReachable && databaseHealthy;
  const voice = await getVoiceProvider('elevenlabs').healthCheck();
  const metaConfigured = Boolean(process.env.META_APP_SECRET);
  const twilioConfigured = Boolean(process.env.TWILIO_AUTH_TOKEN);
  const calendlyConfigured = Boolean(process.env.CALENDLY_CLIENT_SECRET);

  return NextResponse.json(
    {
      status: isHealthy ? 'ok' : 'degraded',
      version: '0.3.0',
      commit: commitSha,
      environment: process.env.NODE_ENV || 'production',
      checks: {
        appwriteApi: appwriteReachable ? 'healthy' : 'unreachable',
        database: databaseHealthy ? 'healthy' : 'unreachable',
        latencyMs,
        metaWhatsAppGlobalEnv: metaConfigured ? 'configured' : 'not_configured',
        tenantWhatsAppNotice:
          'Tenant-level WhatsApp connection status is dynamic and evaluated per session context at /api/whatsapp/config',
        twilioSms: twilioConfigured ? 'configured' : 'not_configured',
        calendly: calendlyConfigured ? 'configured' : 'not_configured',
        voice: {
          status:
            voice.configured &&
            voice.credentialsValid &&
            voice.providerReachable &&
            voice.agentFound &&
            voice.phoneNumberFound
              ? 'connected'
              : voice.configured
                ? 'degraded'
                : 'not_configured',
          configured: voice.configured,
          credentialsValid: voice.credentialsValid,
          providerReachable: voice.providerReachable,
          webhookConfigured: voice.webhookConfigured,
          agentFound: voice.agentFound,
          phoneNumberFound: voice.phoneNumberFound,
        },
      },
      appwrite: {
        connected: isHealthy,
        endpoint: APPWRITE_CONFIG.endpoint,
        projectId: APPWRITE_CONFIG.projectId,
      },
      timestamp,
    },
    {
      status: isHealthy ? 200 : 503,
      headers: {
        'Cache-Control': 'no-store, private',
        'Content-Type': 'application/json',
      },
    }
  );
}
