import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/server';
import { decrypt, encrypt, isLegacyFormat } from '@/lib/whatsapp/encryption';

/**
 * Handles the Meta Webhook Verification challenge GET request.
 */
export async function handleWebhookGet(request: Request): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('hub.mode');
    const challenge = searchParams.get('hub.challenge');
    const verifyToken = searchParams.get('hub.verify_token');

    if (mode !== 'subscribe' || !challenge || !verifyToken) {
      return NextResponse.json(
        { error: 'Missing verification parameters' },
        { status: 400 }
      );
    }

    // 1. Fast path: check global server environment variable
    const envVerifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN;
    if (envVerifyToken && envVerifyToken === verifyToken) {
      return new Response(challenge, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    // 2. Database path: check tenant-specific verify tokens in Supabase
    const db = getAdminClient();
    let configs:
      | { id: string; encryptedVerifyToken?: string; verify_token?: string }[]
      | null = null;

    try {
      const { data } = await db
        .from('whatsapp_configs')
        .select('id, verify_token');
      if (data) configs = data as { id: string; verify_token?: string }[];
    } catch {
      // Fallback
    }

    if (!configs || configs.length === 0) {
      try {
        const { data } = await db
          .from('whatsapp_config')
          .select('id, verify_token');
        if (data) configs = data as { id: string; verify_token?: string }[];
      } catch {
        // Ignore
      }
    }

    if (!configs) {
      console.error('Error fetching configs for verification');
      return NextResponse.json(
        { error: 'Verification failed' },
        { status: 403 }
      );
    }

    // Check if any config's verify token matches
    let matchedConfig: {
      id: string;
      encryptedVerifyToken?: string;
      verify_token?: string;
    } | null = null;

    for (const config of configs) {
      const encToken = config.encryptedVerifyToken || config.verify_token;
      if (!encToken) continue;
      try {
        if (decrypt(encToken) === verifyToken || encToken === verifyToken) {
          matchedConfig = config;
          break;
        }
      } catch {
        // Malformed / wrong-key token row — skip it and keep checking.
      }
    }

    if (matchedConfig) {
      const encToken =
        matchedConfig.encryptedVerifyToken || matchedConfig.verify_token;
      // Fire-and-forget GCM upgrade for legacy CBC tokens
      if (encToken && isLegacyFormat(encToken)) {
        void db
          .from('whatsapp_configs')
          .update({ encrypted_access_token: encrypt(verifyToken) })
          .eq('id', matchedConfig.id)
          .then(({ error }: { error: unknown }) => {
            if (error) {
              console.warn(
                '[webhook] token GCM upgrade failed:',
                (error as { message?: string })?.message ?? error
              );
            }
          });
      }
      return new Response(challenge, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    return NextResponse.json(
      { error: 'Verification token mismatch' },
      { status: 403 }
    );
  } catch (error) {
    console.error('Error in webhook GET verification:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
