import { NextResponse } from 'next/server';
import { checkSuperAdmin } from '@/lib/auth/admin';
import { getAdminClient } from '@/lib/db/server';
import { decrypt } from '@/lib/whatsapp/encryption';

interface CloudflareModelResult {
  id: string;
  name: string;
  description?: string;
  task?: { name?: string; id?: string };
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

    const db = getAdminClient();
    const { data: sysSettings } = await db
      .from('system_settings')
      .select('key, value');

    const settingsMap: Record<string, string> = {};
    sysSettings?.forEach((row: Record<string, unknown>) => {
      if (typeof row.key === 'string' && typeof row.value === 'string') {
        settingsMap[row.key] = row.value;
      }
    });

    const accountId =
      settingsMap.system_cloudflare_account_id ||
      process.env.CLOUDFLARE_ACCOUNT_ID ||
      '75f92db1d186c390f30db1bf0ba036f9';

    let token = process.env.CLOUDFLARE_API_TOKEN;
    if (settingsMap.system_cloudflare_api_token) {
      try {
        token = decrypt(settingsMap.system_cloudflare_api_token);
      } catch {
        // Fallback to env
      }
    }

    if (!token || !token.trim()) {
      return NextResponse.json(
        { error: 'Cloudflare API Token not configured' },
        { status: 400 }
      );
    }

    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId.trim()}/ai/models/search`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token.trim()}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Cloudflare API error (${response.status}): ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    const rawModels: CloudflareModelResult[] = data.result || [];

    // Filter text generation and instruct/chat models
    const textModels = rawModels
      .filter((m) => {
        const taskName = m.task?.name?.toLowerCase() || '';
        const name = (m.name || m.id || '').toLowerCase();
        return (
          taskName.includes('text generation') ||
          name.includes('instruct') ||
          name.includes('chat') ||
          name.includes('llama') ||
          name.includes('deepseek') ||
          name.includes('qwen') ||
          name.includes('mistral') ||
          name.includes('gemma') ||
          name.includes('gpt-oss')
        );
      })
      .map((m) => {
        const id = m.name || m.id;
        const cleanName = id
          .replace(/^@cf\//, '')
          .replace(/^[a-zA-Z0-9_-]+\//, '')
          .replace(/-/g, ' ')
          .replace(/\b\w/g, (l) => l.toUpperCase());

        return {
          id,
          name: `${cleanName} (${id})`,
          description: m.description || '',
          provider: 'cloudflare' as const,
          enabled: true,
        };
      });

    return NextResponse.json({
      success: true,
      accountId,
      models: textModels,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
