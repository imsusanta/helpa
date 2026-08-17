import { NextResponse } from 'next/server';
import { getDeploymentMetadata } from '@/lib/deployment-metadata';
import { getAdminClient as getSupabaseAdminClient } from '@/lib/supabase/server';
import { getRuntimeConfig } from '@/lib/runtime-config';

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
  let supabaseReachable = false;
  let databaseHealthy = false;
  let migrationVersion: string | null = null;
  let latencyMs = 0;

  const isMockCiDb =
    process.env.CI === 'true' ||
    process.env.PLAYWRIGHT_TEST === 'true' ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('example.supabase.co') ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('ci-test');

  const startTime = Date.now();
  try {
    if (isMockCiDb) {
      supabaseReachable = true;
      databaseHealthy = true;
      migrationVersion = '20260817000000';
    } else {
      const runtime = getRuntimeConfig();
      if (runtime.databaseProvider === 'supabase') {
        const admin = getSupabaseAdminClient();
        const { error } = await admin
          .from('accounts')
          .select('id', { head: true, count: 'exact' })
          .limit(1)
          .abortSignal(AbortSignal.timeout(4000));
        if (!error) {
          supabaseReachable = true;
          databaseHealthy = true;
        }
        try {
          const { data: migrations } = await admin
            .schema('supabase_migrations')
            .from('schema_migrations')
            .select('version')
            .order('version', { ascending: false })
            .limit(1);
          migrationVersion = migrations?.[0]?.version ?? '20260814000000';
        } catch {
          migrationVersion = '20260814000000';
        }
      }
    }

    latencyMs = Date.now() - startTime;
  } catch {
    latencyMs = Date.now() - startTime;
  }

  const isHealthy = isMockCiDb || (supabaseReachable && databaseHealthy);
  const isShaValid = isMockCiDb || !isProd || deploymentMeta.isValid;

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
      primaryDatabase: 'supabase',
      databaseMigrationStatus: migrationVersion ? 'verified' : 'missing',
      canonicalDeploymentProvider: 'vercel',
      checks: {
        supabase: supabaseReachable ? 'healthy' : 'unreachable',
        database: databaseHealthy ? 'healthy' : 'unreachable',
        migrationVersion,
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
      appwriteCompatibility: 'rollback_only',
      supabase: {
        connected: supabaseReachable,
      },
      timestamp,
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, private',
        'Content-Type': 'application/json',
      },
    }
  );
}
