import { NextResponse } from 'next/server';
import { createClient } from '@/lib/appwrite-server-compat';
import { getCurrentAccount } from '@/lib/auth/account';
import { getMediaUrl, downloadMedia } from '@/lib/whatsapp/meta-api';
import { decrypt } from '@/lib/whatsapp/encryption';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ mediaId: string }> }
) {
  try {
    const { mediaId } = await params;

    if (!mediaId) {
      return NextResponse.json(
        { error: 'Media ID is required' },
        { status: 400 }
      );
    }

    const appwrite = await createClient();

    const {
      data: { user },
      error: authError,
    } = await appwrite.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let accountId: string | null = null;
    const ctx = await getCurrentAccount().catch(() => null);
    if (ctx?.accountId) {
      accountId = ctx.accountId;
    } else {
      try {
        const { data: profile } = await appwrite
          .from('profiles')
          .select('account_id, accountId')
          .eq('user_id', user.id)
          .maybeSingle();
        if (profile?.account_id || profile?.accountId) {
          accountId = String(profile.account_id || profile.accountId);
        }
      } catch {
        // Fallback
      }
    }

    if (!accountId) {
      return NextResponse.json(
        { error: 'Account membership required' },
        { status: 403 }
      );
    }

    // Fetch and decrypt WhatsApp config
    let config: Record<string, unknown> | null = null;
    try {
      const { data } = await appwrite
        .from('whatsapp_config')
        .select('*')
        .eq('account_id', accountId)
        .single();
      if (data) config = data as Record<string, unknown>;
    } catch {
      // Fallback
    }

    if (!config) {
      try {
        const { data } = await appwrite
          .from('whatsapp_configs')
          .select('*')
          .eq('account_id', accountId)
          .single();
        if (data) config = data as Record<string, unknown>;
      } catch {
        // Ignore
      }
    }

    if (!config) {
      return NextResponse.json(
        { error: 'WhatsApp not configured' },
        { status: 400 }
      );
    }

    const encToken = String(
      config.access_token ||
        config.encrypted_access_token ||
        config.accessToken ||
        ''
    );
    const accessToken = decrypt(encToken);

    // Get the download URL from Meta
    const mediaInfo = await getMediaUrl({ mediaId, accessToken });

    // Download the binary data
    const { buffer, contentType } = await downloadMedia({
      downloadUrl: mediaInfo.url,
      accessToken,
    });

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type':
          contentType || mediaInfo.mimeType || 'application/octet-stream',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (error) {
    console.error('Error in WhatsApp media GET:', error);
    return NextResponse.json(
      { error: 'Failed to fetch media' },
      { status: 500 }
    );
  }
}
