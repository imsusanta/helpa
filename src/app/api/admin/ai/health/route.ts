import { NextResponse } from 'next/server';
import { checkSuperAdmin } from '@/lib/auth/admin';
import { appwriteAdmin } from '@/lib/appwrite-server-compat';
import { decrypt } from '@/lib/whatsapp/encryption';
import { getProviderInstance } from '@/core/ai/provider';

async function resolveAdminProviderCredentials(
  providerName: 'openrouter' | 'orcarouter'
) {
  const db = appwriteAdmin();
  const { data: sysSettings } = await db
    .from('system_settings')
    .select('key, value');

  const settingsMap: Record<string, string> = {};
  sysSettings?.forEach((row: Record<string, unknown>) => {
    if (typeof row.key === 'string' && typeof row.value === 'string') {
      settingsMap[row.key] = row.value;
    }
  });

  let apiKey =
    providerName === 'orcarouter'
      ? process.env.ORCAROUTER_API_KEY
      : process.env.OPENROUTER_API_KEY;

  const encKey =
    providerName === 'orcarouter'
      ? settingsMap.system_orcarouter_api_key
      : settingsMap.system_openrouter_api_key;

  if (encKey) {
    try {
      apiKey = decrypt(encKey);
    } catch {
      // Fallback to env
    }
  }

  const model =
    providerName === 'orcarouter'
      ? settingsMap.system_orcarouter_model || 'orcarouter/auto'
      : settingsMap.system_openrouter_model || 'google/gemini-2.5-flash';

  return { apiKey, model };
}

export async function GET() {
  try {
    const isSuper = await checkSuperAdmin();
    if (!isSuper) {
      return NextResponse.json(
        { error: 'Forbidden: Super Admin access required' },
        { status: 403 }
      );
    }

    const [openCreds, orcaCreds] = await Promise.all([
      resolveAdminProviderCredentials('openrouter'),
      resolveAdminProviderCredentials('orcarouter'),
    ]);

    const openRouter = getProviderInstance('openrouter');
    const orcaRouter = getProviderInstance('orcarouter');

    const [openHealth, orcaHealth] = await Promise.all([
      openRouter.healthCheck(openCreds.apiKey, openCreds.model),
      orcaRouter.healthCheck(orcaCreds.apiKey, orcaCreds.model),
    ]);

    return NextResponse.json({
      openrouter: openHealth,
      orcarouter: orcaHealth,
      checkedAt: new Date().toISOString(),
    });
  } catch (err: unknown) {
    console.error('[GET /api/admin/ai/health] error:', err);
    const msg = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const isSuper = await checkSuperAdmin();
    if (!isSuper) {
      return NextResponse.json(
        { error: 'Forbidden: Super Admin access required' },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const providerName =
      body.provider === 'orcarouter' ? 'orcarouter' : 'openrouter';

    const creds = await resolveAdminProviderCredentials(providerName);
    const testApiKey =
      typeof body.apiKey === 'string' && body.apiKey.trim()
        ? body.apiKey.trim()
        : creds.apiKey;
    const testModel =
      typeof body.model === 'string' && body.model.trim()
        ? body.model.trim()
        : creds.model;

    const provider = getProviderInstance(providerName);
    const health = await provider.healthCheck(testApiKey, testModel);

    if (health.status === 'healthy') {
      return NextResponse.json({
        success: true,
        provider: providerName,
        message: health.message || 'Connected and healthy',
        latencyMs: health.latencyMs,
        checkedAt: new Date().toISOString(),
      });
    }

    return NextResponse.json(
      {
        success: false,
        provider: providerName,
        error: health.message || 'Connection test failed',
        latencyMs: health.latencyMs,
        checkedAt: new Date().toISOString(),
      },
      { status: 400 }
    );
  } catch (err: unknown) {
    console.error('[POST /api/admin/ai/health] error:', err);
    const msg = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
