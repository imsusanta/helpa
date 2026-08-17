import { NextResponse } from 'next/server';
import { checkSuperAdmin } from '@/lib/auth/admin';
import { appwriteAdmin } from '@/lib/appwrite-server-compat';
import { encrypt } from '@/lib/whatsapp/encryption';

export async function GET() {
  try {
    const isSuper = await checkSuperAdmin();
    if (!isSuper) {
      return NextResponse.json(
        { error: 'Forbidden: Super Admin access required' },
        { status: 403 }
      );
    }

    const db = appwriteAdmin();
    const { data, error } = await db
      .from('system_settings')
      .select('key, value');

    if (error) throw error;

    // Convert list to key-value object
    const settings: Record<string, unknown> = {};
    data?.forEach((row: Record<string, unknown>) => {
      if (typeof row.key === 'string') {
        if (row.key.includes('api_key')) {
          // Never return raw secret keys in responses
          settings[`has_${row.key}`] = !!row.value;
        } else {
          settings[row.key] = row.value;
        }
      }
    });

    return NextResponse.json(settings);
  } catch (err: unknown) {
    console.error('[GET /api/admin/settings] error:', err);
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

    const body = await req.json();
    const {
      landing_hero_video_url,
      landing_action_video_url,
      system_openrouter_api_key,
      system_orcarouter_api_key,
      system_ai_provider,
      system_ai_fallback_provider,
      system_openrouter_model,
      system_orcarouter_model,
      available_models,
    } = body;

    const db = appwriteAdmin();
    const upserts: Array<{ key: string; value: string }> = [];

    if (typeof landing_hero_video_url === 'string') {
      upserts.push({ key: 'landing_hero_video_url', value: landing_hero_video_url });
    }
    if (typeof landing_action_video_url === 'string') {
      upserts.push({ key: 'landing_action_video_url', value: landing_action_video_url });
    }
    if (typeof system_ai_provider === 'string' && ['openrouter', 'orcarouter'].includes(system_ai_provider)) {
      upserts.push({ key: 'system_ai_provider', value: system_ai_provider });
    }
    if (typeof system_ai_fallback_provider === 'string' && ['openrouter', 'orcarouter', 'none'].includes(system_ai_fallback_provider)) {
      upserts.push({ key: 'system_ai_fallback_provider', value: system_ai_fallback_provider });
    }
    if (typeof system_openrouter_model === 'string') {
      upserts.push({ key: 'system_openrouter_model', value: system_openrouter_model });
    }
    if (typeof system_orcarouter_model === 'string') {
      upserts.push({ key: 'system_orcarouter_model', value: system_orcarouter_model });
    }
    if (typeof available_models === 'string') {
      upserts.push({ key: 'available_models', value: available_models });
    }

    if (typeof system_openrouter_api_key === 'string' && system_openrouter_api_key.trim().length > 0) {
      upserts.push({ key: 'system_openrouter_api_key', value: encrypt(system_openrouter_api_key.trim()) });
    }
    if (typeof system_orcarouter_api_key === 'string' && system_orcarouter_api_key.trim().length > 0) {
      upserts.push({ key: 'system_orcarouter_api_key', value: encrypt(system_orcarouter_api_key.trim()) });
    }

    if (upserts.length > 0) {
      const { error } = await db
        .from('system_settings')
        .upsert(upserts, { onConflict: 'key' });

      if (error) throw error;
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('[POST /api/admin/settings] error:', err);
    const msg = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
