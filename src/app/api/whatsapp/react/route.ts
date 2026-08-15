import { NextResponse } from 'next/server';
import { createClient } from '@/lib/appwrite-server-compat';
import { getCurrentAccount } from '@/lib/auth/account';
import { sendReactionMessage } from '@/lib/whatsapp/meta-api';
import { decrypt } from '@/lib/whatsapp/encryption';
import { sanitizePhoneForMeta } from '@/lib/whatsapp/phone-utils';
import {
  checkRateLimit,
  rateLimitResponse,
  RATE_LIMITS,
} from '@/lib/rate-limit';

/**
 * POST /api/whatsapp/react
 *
 * Body: { message_id: <internal UUID>, emoji: <single emoji or "" to remove> }
 *
 * Sends the reaction to Meta and mirrors it into `message_reactions`
 * (delete on empty emoji). Customer-side reactions are handled by the
 * webhook — this route only writes `actor_type = 'agent'` rows.
 */
export async function POST(request: Request) {
  try {
    const appwrite = await createClient();

    const {
      data: { user },
      error: authError,
    } = await appwrite.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const limit = checkRateLimit(`react:${user.id}`, RATE_LIMITS.react);
    if (!limit.success) {
      return rateLimitResponse(limit);
    }

    let accountId: string | null = null;
    const ctx = await getCurrentAccount().catch(() => null);
    if (ctx?.accountId) {
      accountId = ctx.accountId;
    } else {
      const { data: profile } = await appwrite
        .from('profiles')
        .select('account_id, accountId')
        .eq('user_id', user.id)
        .maybeSingle()
        .catch(() => ({ data: null }));
      if (profile?.account_id || profile?.accountId) {
        accountId = String(profile.account_id || profile.accountId);
      }
    }

    if (!accountId) {
      return NextResponse.json(
        { error: 'Account membership required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { message_id, emoji } = body as {
      message_id?: string;
      emoji?: string;
    };

    if (!message_id || typeof emoji !== 'string') {
      return NextResponse.json(
        { error: 'message_id and emoji are required' },
        { status: 400 }
      );
    }

    // Resolve target message + its conversation; verify ownership.
    const { data: targetMessage, error: msgError } = await appwrite
      .from('messages')
      .select('id, message_id, conversation_id')
      .eq('id', message_id)
      .maybeSingle();

    if (msgError || !targetMessage) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    if (!targetMessage.message_id) {
      // No Meta ID yet — usually a sending/failed agent message. We can't
      // tell Meta to react to a message it never received.
      return NextResponse.json(
        {
          error: 'Cannot react to a message that has not been sent to WhatsApp',
        },
        { status: 400 }
      );
    }

    const { data: conversation, error: convError } = await appwrite
      .from('conversations')
      .select('id, account_id, contact:contacts(phone)')
      .eq('id', targetMessage.conversation_id)
      .eq('account_id', accountId)
      .maybeSingle();

    if (convError || !conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    const contact = Array.isArray(conversation.contact)
      ? conversation.contact[0]
      : conversation.contact;
    if (!contact?.phone) {
      return NextResponse.json(
        { error: 'Contact phone number not found' },
        { status: 400 }
      );
    }

    // WhatsApp config + access token. Account-scoped post-multi-user.
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
        { error: 'WhatsApp not configured.' },
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
    const sanitizedPhone = sanitizePhoneForMeta(contact.phone);
    const phoneNumberId = String(
      config.phone_number_id || config.phoneNumberId || ''
    );

    try {
      await sendReactionMessage({
        phoneNumberId,
        accessToken,
        to: sanitizedPhone,
        targetMessageId: targetMessage.message_id,
        emoji,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unknown Meta API error';
      console.error('[whatsapp/react] Meta send failed:', message);
      return NextResponse.json(
        { error: `Meta API error: ${message}` },
        { status: 502 }
      );
    }

    // Mirror into DB. Empty emoji = removal.
    if (emoji === '') {
      const { error: delError } = await appwrite
        .from('message_reactions')
        .delete()
        .eq('message_id', targetMessage.id)
        .eq('actor_type', 'agent')
        .eq('actor_id', user.id);

      if (delError) {
        console.error('[whatsapp/react] DB delete failed:', delError.message);
        return NextResponse.json(
          { error: 'Reaction sent to Meta but DB delete failed' },
          { status: 500 }
        );
      }
    } else {
      // Upsert. The unique constraint (message_id, actor_type, actor_id)
      // lets us swap emoji in a single statement.
      const { error: upsertError } = await appwrite
        .from('message_reactions')
        .upsert(
          {
            message_id: targetMessage.id,
            conversation_id: targetMessage.conversation_id,
            actor_type: 'agent',
            actor_id: user.id,
            emoji,
          },
          { onConflict: 'message_id,actor_type,actor_id' }
        );

      if (upsertError) {
        console.error(
          '[whatsapp/react] DB upsert failed:',
          upsertError.message
        );
        return NextResponse.json(
          { error: 'Reaction sent to Meta but DB upsert failed' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in WhatsApp react POST:', error);
    return NextResponse.json(
      { error: 'Failed to react to message' },
      { status: 500 }
    );
  }
}
