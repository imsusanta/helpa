import { NextResponse } from 'next/server';
import { createClient } from '@/lib/appwrite-server-compat';
import { getCurrentAccount } from '@/lib/auth/account';
import {
  sendTextMessage,
  sendTemplateMessage,
  sendMediaMessage,
  type MediaKind,
} from '@/lib/whatsapp/meta-api';
import { decrypt, encrypt, isLegacyFormat } from '@/lib/whatsapp/encryption';
import { appwriteAdmin } from '@/lib/appwrite-server-compat';
import {
  sanitizePhoneForMeta,
  isValidE164,
  phoneVariants,
  isRecipientNotAllowedError,
} from '@/lib/whatsapp/phone-utils';
import {
  checkRateLimit,
  rateLimitResponse,
  RATE_LIMITS,
} from '@/lib/rate-limit';
import type { MessageTemplate } from '@/types';
import { isMessageTemplate } from '@/lib/whatsapp/template-row-guard';

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

    // Per-user rate limit. Bucket key is scoped to this route so
    // `/broadcast` has an independent budget.
    const limit = checkRateLimit(`send:${user.id}`, RATE_LIMITS.send);
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
    const idempotencyKey =
      request.headers.get('x-idempotency-key') || body.idempotency_key;
    let conversation_id = body.conversation_id;
    const message_type = body.message_type || 'text';
    const content_text = body.content_text || body.message;
    const media_url = body.media_url;
    const filename = body.filename;
    const template_name = body.template_name;
    const template_language = body.template_language;
    const template_params = body.template_params;
    const template_message_params = body.template_message_params;
    const reply_to_message_id = body.reply_to_message_id;

    const dbAdmin = appwriteAdmin();

    // Validate contact_id tenant scoping if contact_id is explicitly provided
    if (body.contact_id) {
      const { data: verifiedContact } = await dbAdmin
        .from('contacts')
        .select('id')
        .eq('id', body.contact_id)
        .eq('accountId', accountId)
        .maybeSingle();

      if (!verifiedContact) {
        return NextResponse.json(
          { error: 'Contact not found or access denied' },
          { status: 404 }
        );
      }
    }

    // Check optional Outbound Idempotency key
    if (idempotencyKey) {
      const { data: existingOutbox } = await dbAdmin
        .from('outbound_outbox')
        .select('*')
        .eq('account_id', accountId)
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle();

      if (existingOutbox) {
        if (existingOutbox.status === 'sent') {
          return NextResponse.json({
            success: true,
            message_id: existingOutbox.meta_message_id,
            idempotent: true,
          });
        }
        if (
          existingOutbox.status === 'processing' ||
          existingOutbox.status === 'pending'
        ) {
          return NextResponse.json(
            {
              error: 'DUPLICATE_REQUEST',
              message: 'Message send request already in progress',
            },
            { status: 409 }
          );
        }
      }
    }
    // Auto-resolve or create conversation if conversation_id was not provided
    if (!conversation_id && (body.contact_id || body.phone)) {
      let resolvedContactId = body.contact_id;

      if (!resolvedContactId && body.phone) {
        const cleanPhone = sanitizePhoneForMeta(body.phone);
        const rawPhone = body.phone.trim();
        const plusPhone = rawPhone.startsWith('+')
          ? rawPhone
          : `+${cleanPhone}`;

        // Try finding an existing contact by phone. Uses multiple
        // strategies because Appwrite may lack the indexes needed
        // for composite or() queries.
        const variants = [cleanPhone, plusPhone, rawPhone];
        const uniqueVariants = [...new Set(variants)];
        let foundContact: { id: string } | null = null;

        // Strategy 1: individual eq queries per phone variant
        for (const variant of uniqueVariants) {
          try {
            const { data: match } = await dbAdmin
              .from('contacts')
              .select('id, accountId, account_id')
              .eq('accountId', accountId)
              .eq('phone', variant)
              .limit(1);
            if (match && match.length > 0) {
              foundContact = match[0];
              break;
            }
          } catch {
            // Index or attribute missing — try next
          }
        }

        // Strategy 2: fetch all contacts for this account, filter phone in memory
        if (!foundContact) {
          try {
            const { data: allContacts } = await dbAdmin
              .from('contacts')
              .select('id, accountId, account_id, phone')
              .eq('accountId', accountId)
              .limit(500);
            if (allContacts && allContacts.length > 0) {
              foundContact =
                allContacts.find((c: Record<string, unknown>) =>
                  uniqueVariants.includes(String(c.phone || ''))
                ) || null;
            }
          } catch {
            // Fall through to contact creation
          }
        }

        if (foundContact) {
          resolvedContactId = foundContact.id;
        } else {
          // Create a new contact — use camelCase field names to match schema
          try {
            const now = new Date().toISOString();
            const { data: newContact } = await dbAdmin
              .from('contacts')
              .insert({
                accountId,
                phone: plusPhone,
                name: body.name || cleanPhone,
                createdAt: now,
                updatedAt: now,
              })
              .select('id')
              .single();

            if (newContact) {
              resolvedContactId = newContact.id;
            }
          } catch (insertErr) {
            console.error('[whatsapp/send] Contact insert failed:', insertErr);
          }
        }
      }

      if (resolvedContactId) {
        // Find existing conversation — use camelCase field names
        let { data: extConv } = await dbAdmin
          .from('conversations')
          .select('id')
          .eq('contactId', resolvedContactId)
          .eq('accountId', accountId)
          .maybeSingle();

        if (!extConv) {
          const now = new Date().toISOString();
          const { data: createdConv, error: convErr } = await dbAdmin
            .from('conversations')
            .insert({
              accountId,
              contactId: resolvedContactId,
              status: 'open',
              lastMessageText: content_text || 'Outbound message',
              lastMessageAt: now,
              createdAt: now,
              updatedAt: now,
            })
            .select('id')
            .single();

          if (convErr) {
            console.error(
              '[whatsapp/send] Conversation insert error:',
              convErr
            );
          }

          extConv = createdConv;
        }

        if (extConv) {
          conversation_id = extConv.id;
        }
      }
    }

    if (!conversation_id) {
      return NextResponse.json(
        { error: 'Could not resolve conversation for recipient' },
        { status: 400 }
      );
    }

    // Media kinds (image/video/document/audio) are sent to Meta via a
    // public URL the composer already uploaded to the chat-media bucket.
    const MEDIA_KINDS = ['image', 'video', 'document', 'audio'] as const;
    const isMediaKind = (MEDIA_KINDS as readonly string[]).includes(
      message_type
    );

    // Reject anything outside the known set up front rather than letting
    // an unknown type fall through to the text path with empty content.
    const VALID_MESSAGE_TYPES = ['text', 'template', ...MEDIA_KINDS] as const;
    if (!(VALID_MESSAGE_TYPES as readonly string[]).includes(message_type)) {
      return NextResponse.json(
        { error: `Unsupported message_type "${message_type}"` },
        { status: 400 }
      );
    }

    if (message_type === 'text' && !content_text) {
      return NextResponse.json(
        { error: 'content_text is required for text messages' },
        { status: 400 }
      );
    }

    if (message_type === 'template' && !template_name) {
      return NextResponse.json(
        { error: 'template_name is required for template messages' },
        { status: 400 }
      );
    }

    if (isMediaKind && !media_url) {
      return NextResponse.json(
        { error: `media_url is required for ${message_type} messages` },
        { status: 400 }
      );
    }

    // Meta caps media captions at 1024 chars; reject before the upload is
    // wasted at the Meta call. (Audio carries no caption — see meta-api.)
    if (
      isMediaKind &&
      message_type !== 'audio' &&
      typeof content_text === 'string' &&
      content_text.length > 1024
    ) {
      return NextResponse.json(
        { error: 'Caption exceeds the 1024-character limit' },
        { status: 400 }
      );
    }

    // Fetch conversation and contact via admin client to guarantee resolution
    const { data: conversation, error: convError } = await dbAdmin
      .from('conversations')
      .select('*, contact:contacts(*)')
      .eq('id', conversation_id)
      .eq('accountId', accountId)
      .single();

    if (convError || !conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    const contact = conversation.contact;
    if (!contact?.phone) {
      return NextResponse.json(
        { error: 'Contact phone number not found' },
        { status: 400 }
      );
    }

    // Sanitize and validate phone
    const sanitizedPhone = sanitizePhoneForMeta(contact.phone);
    if (!isValidE164(sanitizedPhone)) {
      return NextResponse.json(
        { error: 'Invalid phone number format' },
        { status: 400 }
      );
    }

    // Fetch and decrypt WhatsApp config
    const { data: config, error: configError } = await dbAdmin
      .from('whatsapp_configs')
      .select('*')
      .eq('accountId', accountId)
      .single();

    if (configError || !config) {
      return NextResponse.json(
        {
          error:
            'WhatsApp not configured. Please set up your WhatsApp integration first.',
        },
        { status: 400 }
      );
    }

    let accessToken: string;
    try {
      const encryptedToken =
        config.encryptedAccessToken ||
        config.encrypted_access_token ||
        config.accessToken ||
        config.access_token;
      accessToken = decrypt(encryptedToken);
    } catch (err: unknown) {
      console.error('[send/route.ts] Access token decryption failed:', err);
      return NextResponse.json(
        {
          error:
            'WhatsApp Access Token decryption failed. The ENCRYPTION_KEY may have been updated. Please re-save your Meta WhatsApp Access Token in Settings → WhatsApp Integration.',
        },
        { status: 400 }
      );
    }

    // Self-heal legacy CBC-encrypted tokens. Fire-and-forget: we
    // return from the send without waiting, so a failed upgrade just
    // means the next send tries again. The upgrade is idempotent —
    // concurrent sends both produce valid GCM ciphertexts of the same
    // plaintext, last write wins.
    if (
      isLegacyFormat(
        config.access_token ||
          config.accessToken ||
          config.encryptedAccessToken ||
          config.encrypted_access_token
      )
    ) {
      void dbAdmin
        .from('whatsapp_configs')
        .update({ encryptedAccessToken: encrypt(accessToken) })
        .eq('id', config.id)
        .then(({ error }: { error: { message: string } | null }) => {
          if (error) {
            console.warn(
              '[whatsapp/send] access_token GCM upgrade failed:',
              error.message
            );
          }
        });
    }

    // Resolve the reply target (if any) to its Meta message_id, which is
    // what `context.message_id` on the outgoing Meta payload needs. The
    // parent must belong to this same conversation — otherwise a caller
    // could quote messages they can't see by guessing UUIDs.
    let contextMessageId: string | undefined;
    if (reply_to_message_id) {
      const { data: parent, error: parentError } = await dbAdmin
        .from('messages')
        .select('messageId, conversationId, message_id, conversation_id')
        .eq('id', reply_to_message_id)
        .eq('conversationId', conversation_id)
        .maybeSingle();

      if (parentError || !parent) {
        return NextResponse.json(
          { error: 'reply_to_message_id not found in this conversation' },
          { status: 400 }
        );
      }
      if (!parent.message_id && !parent.messageId) {
        // Parent never reached Meta (still in 'sending' or 'failed') — we
        // can't quote it on WhatsApp. Send without context rather than
        // dropping the message entirely.
        console.warn(
          '[whatsapp/send] reply target has no Meta message_id; sending without context'
        );
      } else {
        contextMessageId = parent.message_id || parent.messageId;
      }
    }

    // Send via Meta API — retry with phone-number variants if Meta rejects
    // with "recipient not in allowed list" (common in sandbox / when a
    // number was registered with/without a trunk 0). If an alternate
    // format succeeds, we persist it back to the contact row so the
    // next send goes through on the first attempt.
    let waMessageId = '';
    let workingPhone = sanitizedPhone;

    // For template sends, load the row so sendTemplateMessage can
    // build header + button components from the template definition.
    // Match on (user_id, name, language) — same triple the unique
    // index enforces — so multi-language templates work correctly.
    // Missing template falls through with `templateRow = null` and
    // the legacy body-only path runs.
    // Load the template row so sendTemplateMessage can build header
    // + button components from the definition. isMessageTemplate
    // guards against a malformed row (e.g. from a partial sync)
    // crashing the send-builder later in the stack.
    let templateRow: MessageTemplate | null = null;
    if (message_type === 'template' && template_name) {
      const { data } = await dbAdmin
        .from('message_templates')
        .select('*')
        .eq('accountId', accountId)
        .eq('name', template_name)
        .eq('language', template_language || 'en_US')
        .maybeSingle();
      if (data && !isMessageTemplate(data)) {
        return NextResponse.json(
          {
            error:
              'Template row is malformed locally — run "Sync from Meta" in Settings to repair it.',
          },
          { status: 500 }
        );
      }
      templateRow = data ?? null;
    }

    const attempt = async (phone: string): Promise<string> => {
      if (message_type === 'template') {
        const result = await sendTemplateMessage({
          phoneNumberId: config.phone_number_id,
          accessToken,
          to: phone,
          templateName: template_name,
          language: template_language || 'en_US',
          template: templateRow ?? undefined,
          messageParams: template_message_params ?? undefined,
          // Legacy body-only fallback — only consulted when
          // messageParams.body isn't set.
          params: template_params || [],
          contextMessageId,
        });
        return result.messageId;
      }
      if (isMediaKind) {
        // content_text doubles as the caption (ignored for audio inside
        // sendMediaMessage). filename surfaces in the recipient's chat
        // for documents only.
        const result = await sendMediaMessage({
          phoneNumberId: config.phone_number_id,
          accessToken,
          to: phone,
          kind: message_type as MediaKind,
          link: media_url,
          caption: content_text || undefined,
          filename: filename || undefined,
          contextMessageId,
        });
        return result.messageId;
      }
      const result = await sendTextMessage({
        phoneNumberId: config.phone_number_id,
        accessToken,
        to: phone,
        text: content_text,
        contextMessageId,
      });
      return result.messageId;
    };

    try {
      const variants = phoneVariants(sanitizedPhone);
      let lastError: unknown = null;

      for (const variant of variants) {
        try {
          waMessageId = await attempt(variant);
          workingPhone = variant;
          lastError = null;
          break;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          // Only retry when the failure is specifically that the
          // recipient isn't in Meta's allowed list. Any other error
          // (bad token, invalid template, etc.) bubbles up immediately.
          if (!isRecipientNotAllowedError(message)) {
            throw err;
          }
          lastError = err;
          console.warn(
            `[whatsapp/send] variant "${variant}" rejected by Meta, trying next…`
          );
        }
      }

      if (lastError) throw lastError;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unknown Meta API error';
      console.error('Meta API send failed for all variants:', message);
      return NextResponse.json(
        { error: `Meta API error: ${message}` },
        { status: 502 }
      );
    }

    // If a non-original variant succeeded, update the contact so future
    // sends go straight through. sanitizePhoneForMeta on workingPhone
    // will yield workingPhone itself, so re-storing preserves it.
    if (workingPhone !== sanitizedPhone) {
      console.log(
        `[whatsapp/send] Auto-corrected contact phone: ${sanitizedPhone} → ${workingPhone}`
      );
      await appwrite
        .from('contacts')
        .update({ phone: workingPhone })
        .eq('id', contact.id);
    }

    // Insert message into DB — field names MUST match the messages schema
    // (see appwrite/migrations/001_initial_schema.sql):
    //   conversation_id, sender_type, content_type, content_text,
    //   media_url, template_name, message_id, status, created_at
    const { data: messageRecord, error: msgError } = await dbAdmin
      .from('messages')
      .insert({
        conversationId: conversation_id,
        senderType: 'agent',
        contentType: message_type,
        contentText: content_text || null,
        mediaUrl: media_url || null,
        templateName: template_name || null,
        messageId: waMessageId,
        status: 'sent',
        replyToMessageId: reply_to_message_id || null,
        createdAt: new Date().toISOString(),
      })
      .select()
      .single();

    if (msgError) {
      console.error('Error inserting sent message:', msgError);
      return NextResponse.json(
        {
          error: `Message sent to Meta but failed to save to DB: ${msgError.message}`,
        },
        { status: 500 }
      );
    }

    // Update conversation
    await dbAdmin
      .from('conversations')
      .update({
        lastMessageText: content_text || `[${message_type}]`,
        lastMessageAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .eq('id', conversation_id);

    // Pause any active Flow run for this contact — the agent stepping
    // in is the strongest "yield, human is here" signal. See PR #2
    // plan for why we pause (not end): preserves diagnostic state +
    // lets the agent or the 24h timeout sweep cleanly resolve the
    // run later. For accounts with no active runs the UPDATE matches
    // zero rows — cheap and harmless.
    try {
      const { error: pauseErr } = await dbAdmin
        .from('flow_runs')
        .update({
          status: 'paused_by_agent',
          endedAt: new Date().toISOString(),
          endReason: 'agent_replied',
        })
        .eq('accountId', accountId)
        .eq('contactId', contact.id)
        .eq('status', 'active');
      if (pauseErr) {
        // Best-effort — log + continue. The agent's message already
        // landed at Meta; don't fail the response over a bookkeeping
        // miss. Worst case: a stale active run gets caught by the
        // stale-run cron sweep within 24h.
        console.error('[flows] pause-on-agent-send failed:', pauseErr.message);
      }
    } catch (err) {
      console.error(
        '[flows] pause-on-agent-send threw:',
        err instanceof Error ? err.message : err
      );
    }

    return NextResponse.json({
      success: true,
      message_id: messageRecord.id,
      whatsapp_message_id: waMessageId,
    });
  } catch (error) {
    console.error('Error in WhatsApp send POST:', error);
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    );
  }
}
