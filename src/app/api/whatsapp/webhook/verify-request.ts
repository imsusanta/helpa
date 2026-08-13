import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/appwrite-server-compat';
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

    // Fetch all whatsapp configs to check verify tokens
    const { data: configs, error: configError } = await getAdminClient()
      .from('whatsapp_configs')
      .select('id, encryptedVerifyToken, verify_token');

    if (configError || !configs) {
      console.error('Error fetching configs for verification:', configError);
      return NextResponse.json(
        { error: 'Verification failed' },
        { status: 403 }
      );
    }

    // Check if any config's encryptedVerifyToken matches
    let matchedConfig: {
      id: string;
      encryptedVerifyToken?: string;
      verify_token?: string;
    } | null = null;
    for (const config of configs) {
      const encToken = config.encryptedVerifyToken || config.verify_token;
      if (!encToken) continue;
      try {
        if (decrypt(encToken) === verifyToken) {
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
        void getAdminClient()
          .from('whatsapp_configs')
          .update({ encryptedVerifyToken: encrypt(verifyToken) })
          .eq('id', matchedConfig.id)
          .then(({ error }: { error: unknown }) => {
            if (error) {
              console.warn(
                '[webhook] encryptedVerifyToken GCM upgrade failed:',
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
