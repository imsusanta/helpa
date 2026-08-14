import { NextResponse } from 'next/server';
import { APPWRITE_CONFIG } from '@/infrastructure/appwrite/config';
import { getAppwriteAdminClient } from '@/infrastructure/appwrite/server';
import { getDeploymentMetadata } from '@/lib/deployment-metadata';

export async function GET(request: Request) {
  const timestamp = new Date().toISOString();
  const { pathname } = new URL(request.url);

  const deploymentMeta = getDeploymentMetadata(process.env);
  const isProd = process.env.NODE_ENV === 'production';

  // /api/health/live - Liveness Probe (Lightweight check)
  if (pathname.endsWith('/live')) {
    return NextResponse.json(
      {
        status: 'ok',
        version: deploymentMeta.version,
        commit: deploymentMeta.commit,
        deploymentShaStatus: deploymentMeta.deploymentShaStatus,
        commitSource: deploymentMeta.commitSource,
        buildTime: deploymentMeta.buildTime,
        timestamp,
      },
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
  const isShaValid = !isProd || deploymentMeta.isValid;

  // Final system status
  const overallStatus = isHealthy && isShaValid ? 'ok' : 'degraded';
  const metaConfigured = Boolean(process.env.META_APP_SECRET);
  const twilioConfigured = Boolean(process.env.TWILIO_AUTH_TOKEN);
  const calendlyConfigured = Boolean(process.env.CALENDLY_CLIENT_SECRET);

  return NextResponse.json(
    {
      status: overallStatus,
      version: deploymentMeta.version,
      commit: deploymentMeta.commit,
      deploymentShaStatus: deploymentMeta.deploymentShaStatus,
      commitSource: deploymentMeta.commitSource,
      environment: deploymentMeta.environment,
      buildTime: deploymentMeta.buildTime,
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
          status: 'not_configured',
          releaseBlocking: false,
          configured: false,
          notice:
            'Voice CRM is excluded from the current production release scope (Option A: WhatsApp CRM focus).',
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
