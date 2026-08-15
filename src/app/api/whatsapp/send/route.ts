import { NextResponse } from 'next/server';
import crypto from 'crypto';
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
import { OutboxService } from '@/lib/whatsapp/outbox-service';

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

    const effectiveIdempotencyKey =
      idempotencyKey ||
      `send_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;

    // Auto-resolve or create conversation if conversation_id was not provided
    if (!conversation_id && (body.contact_id || body.phone)) {
      let resolvedContactId = body.contact_id;

      if (!resolvedContactId && body.phone) {
        const cleanPhone = sanitizePhoneForMeta(body.phone);
        const rawPhone = body.phone.trim();
        const plusPhone = rawPhone.startsWith('+')
          ? rawPhone
          : `+${cleanPhone}`;

        const variants = [cleanPhone, plusPhone, rawPhone];
        const uniqueVariants = [...new Set(variants)];
        let foundContact: { id: string } | null = null;

        // Strategy 1: query by account_id / accountId
        for (const variant of uniqueVariants) {
          try {
            const { data: match } = await dbAdmin
              .from('contacts')
              .select('id, account_id, accountId')
              .eq('account_id', accountId)
              .eq('phone', variant)
              .limit(1);
            if (match && match.length > 0) {
              foundContact = match[0];
              break;
            }
          } catch {
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
              // Ignore
            }
          }
        }

        if (foundContact) {
          resolvedContactId = foundContact.id;
        } else {
          // Create a new contact
          try {
            const now = new Date().toISOString();
            const { data: newContact } = await dbAdmin
              .from('contacts')
              .insert({
                account_id: accountId,
                user_id: ctx?.userId || null,
                phone: plusPhone,
                phone_normalized: cleanPhone,
                name: body.name || cleanPhone,
                created_at: now,
                updated_at: now,
              })
              .select('id')
              .single();

            if (newContact) {
              resolvedContactId = newContact.id;
            } else {
              const { data: legacyContact } = await dbAdmin
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
              if (legacyContact) {
                resolvedContactId = legacyContact.id;
              }
            }
          } catch (insertErr) {
            console.error('[whatsapp/send] Contact insert failed:', insertErr);
          }
        }
      }

      if (resolvedContactId) {
        // Find existing conversation
        let extConv: { id: string } | null = null;
        try {
          const { data: convData } = await dbAdmin
            .from('conversations')
            .select('id')
            .eq('contact_id', resolvedContactId)
            .eq('account_id', accountId)
            .maybeSingle();
          if (convData) extConv = convData;
        } catch {
          try {
            const { data: convData } = await dbAdmin
              .from('conversations')
              .select('id')
              .eq('contactId', resolvedContactId)
              .eq('accountId', accountId)
              .maybeSingle();
            if (convData) extConv = convData;
          } catch {
            // Ignore
          }
        }

        if (!extConv) {
          const now = new Date().toISOString();
          try {
            const { data: createdConv, error: convErr } = await dbAdmin
              .from('conversations')
              .insert({
                account_id: accountId,
                user_id: ctx?.userId || null,
                contact_id: resolvedContactId,
                status: 'open',
                last_message_text: content_text || 'Outbound message',
                last_message_at: now,
                created_at: now,
                updated_at: now,
              })
              .select('id')
              .single();

            if (createdConv) {
              extConv = createdConv;
            } else {
              const { data: legacyConv } = await dbAdmin
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
              if (legacyConv) extConv = legacyConv;
            }
          } catch (insertErr) {
            console.error(
              '[whatsapp/send] Conversation insert threw:',
              insertErr
            );
          }
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

    // Fetch conversation and contact via admin client with strict tenant scoping
    let conversation: Record<string, unknown> | null = null;
    try {
      const { data: convData } = await dbAdmin
        .from('conversations')
        .select('*, contact:contacts(*)')
        .eq('id', conversation_id)
        .eq('account_id', accountId)
        .single();
      if (
        convData &&
        String(convData.account_id || convData.accountId || '') ===
          String(accountId)
      ) {
        conversation = convData;
      }
    } catch {
      try {
        const { data: convData } = await dbAdmin
          .from('conversations')
          .select('*, contact:contacts(*)')
          .eq('id', conversation_id)
          .eq('accountId', accountId)
          .single();
        if (
          convData &&
          String(convData.account_id || convData.accountId || '') ===
            String(accountId)
        ) {
          conversation = convData;
        }
      } catch {
        // Fall through to not found
      }
    }

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found or access denied' },
        { status: 404 }
      );
    }

    let contactPhone =
      (conversation.contact as { phone?: string })?.phone ||
      (conversation as { contact_phone?: string }).contact_phone ||
      (conversation as { phone?: string }).phone ||
      body.phone;

    const contactId =
      (conversation.contact as { id?: string })?.id ||
      (conversation as { contact_id?: string }).contact_id ||
      (conversation as { contactId?: string }).contactId ||
      body.contact_id;

    if (!contactPhone && contactId) {
      try {
        const { data: directContact } = await dbAdmin
          .from('contacts')
          .select('*')
          .eq('id', contactId)
          .eq('account_id', accountId)
          .single();

        if (
          directContact?.phone &&
          String(directContact.account_id || directContact.accountId || '') ===
            String(accountId)
        ) {
          contactPhone = directContact.phone;
        }
      } catch {
        try {
          const { data: directContact } = await dbAdmin
            .from('contacts')
            .select('*')
            .eq('id', contactId)
            .eq('accountId', accountId)
            .single();

          if (
            directContact?.phone &&
            String(
              directContact.accountId || directContact.account_id || ''
            ) === String(accountId)
          ) {
            contactPhone = directContact.phone;
          }
        } catch {
          // Could not fetch contact
        }
      }
    }

    if (!contactPhone) {
      return NextResponse.json(
        { error: 'Contact phone number not found' },
        { status: 400 }
      );
    }

    // Sanitize and validate phone
    const sanitizedPhone = sanitizePhoneForMeta(contactPhone);
    if (!isValidE164(sanitizedPhone)) {
      return NextResponse.json(
        { error: 'Invalid phone number format' },
        { status: 400 }
      );
    }

    // Fetch and decrypt WhatsApp config strictly for this tenant
    let config: Record<string, unknown> | null = null;
    try {
      const { data: conf1 } = await dbAdmin
        .from('whatsapp_config')
        .select('*')
        .eq('account_id', accountId)
        .maybeSingle();
      if (
        conf1 &&
        String(conf1.account_id || conf1.accountId || '') === String(accountId)
      ) {
        config = conf1;
      }
    } catch {
      try {
        const { data: conf2 } = await dbAdmin
          .from('whatsapp_configs')
          .select('*')
          .eq('accountId', accountId)
          .maybeSingle();
        if (
          conf2 &&
          String(conf2.accountId || conf2.account_id || '') ===
            String(accountId)
        ) {
          config = conf2;
        }
      } catch {
        // Fall through to not configured
      }
    }

    if (!config) {
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
      const encryptedToken = String(
        config.encryptedAccessToken ||
          config.encrypted_access_token ||
          config.accessToken ||
          config.access_token ||
          ''
      );
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

    if (
      isLegacyFormat(
        String(
          config.access_token ||
            config.accessToken ||
            config.encryptedAccessToken ||
            config.encrypted_access_token ||
            ''
        )
      )
    ) {
      void dbAdmin
        .from('whatsapp_configs')
        .update({ encryptedAccessToken: encrypt(accessToken) })
        .eq('id', String(config.id || ''))
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
        .maybeSingle();

      const parentConvId = parent?.conversation_id || parent?.conversationId;
      if (parentError || !parent || parentConvId !== conversation_id) {
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

    // 1. Calculate deterministic request hash for idempotency payload verification
    const requestPayloadToHash = JSON.stringify({
      conversation_id,
      contact_id: contactId,
      phone: sanitizedPhone,
      message_type,
      content_text,
      media_url,
      template_name,
      template_language,
      reply_to_message_id,
    });
    const requestHash = crypto
      .createHash('sha256')
      .update(requestPayloadToHash)
      .digest('hex');

    // 2. Pre-send outbox check & lock
    const outboxRes = await OutboxService.createPreSendOutbox({
      accountId,
      idempotencyKey: effectiveIdempotencyKey,
      requestHash,
      channel: 'whatsapp',
      conversationId: conversation_id,
      contactId: contactId || null,
      provider: 'meta',
    });

    if (!outboxRes.ok) {
      return NextResponse.json(
        {
          error: outboxRes.code,
          message: outboxRes.message,
          correlationId: crypto.randomUUID(),
        },
        { status: outboxRes.code === 'IDEMPOTENCY_CONFLICT' ? 409 : 503 }
      );
    }

    if (outboxRes.status === 'existing') {
      if (outboxRes.existingStatus === 'sent') {
        return NextResponse.json({
          success: true,
          message_id: outboxRes.providerMessageId || outboxRes.outboxId,
          idempotent: true,
        });
      }
      if (
        outboxRes.existingStatus === 'processing' ||
        outboxRes.existingStatus === 'pending'
      ) {
        return NextResponse.json(
          {
            error: 'DUPLICATE_REQUEST_IN_PROGRESS',
            status: 'processing',
            message: 'Message send request already in progress',
          },
          { status: 202 }
        );
      }
      if (outboxRes.existingStatus === 'reconciliation_required') {
        return NextResponse.json(
          {
            status: 'reconciliation_required',
            message_id: outboxRes.providerMessageId,
            message:
              'Message send recorded on Meta, awaiting local reconciliation',
          },
          { status: 202 }
        );
      }
      if (outboxRes.existingStatus === 'dead_letter') {
        return NextResponse.json(
          {
            error: 'PREVIOUS_SEND_FAILED',
            message: 'Previous message send attempt failed permanently',
          },
          { status: 422 }
        );
      }
    }

    const outboxDocId = outboxRes.outboxId;

    const attempt = async (phone: string): Promise<string> => {
      const phoneNumberId = String(
        config.phone_number_id || config.phoneNumberId || ''
      );
      if (message_type === 'template') {
        const result = await sendTemplateMessage({
          phoneNumberId,
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
          phoneNumberId,
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
        phoneNumberId,
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

      if (outboxDocId) {
        await OutboxService.markDeadLetter(outboxDocId, accountId, message);
      }

      return NextResponse.json(
        { error: `Meta API error: ${message}` },
        { status: 502 }
      );
    }

    // If a non-original variant succeeded, update the contact so future
    // sends go straight through. sanitizePhoneForMeta on workingPhone
    // will yield workingPhone itself, so re-storing preserves it.
    if (workingPhone !== sanitizedPhone && contactId) {
      console.log(
        `[whatsapp/send] Auto-corrected contact phone: ${sanitizedPhone} → ${workingPhone}`
      );
      await dbAdmin
        .from('contacts')
        .update({ phone: workingPhone })
        .eq('id', contactId)
        .eq('accountId', accountId);
    }

    const isValidUUID = (str?: string | null) =>
      typeof str === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        str
      );

    const cleanReplyToId = isValidUUID(reply_to_message_id)
      ? reply_to_message_id
      : null;

    const messageInsertData: {
      conversation_id: string;
      sender_type: 'agent';
      content_type: string;
      content_text: string | null;
      media_url: string | null;
      template_name: string | null;
      message_id: string;
      status: 'sent';
      created_at: string;
      reply_to_message_id?: string;
    } = {
      conversation_id,
      sender_type: 'agent',
      content_type: message_type,
      content_text: content_text || null,
      media_url: media_url || null,
      template_name: template_name || null,
      message_id: waMessageId,
      status: 'sent',
      created_at: new Date().toISOString(),
    };

    if (cleanReplyToId) {
      messageInsertData.reply_to_message_id = cleanReplyToId;
    }

    // Insert message into DB — strict PostgreSQL schema compatibility
    const { data: messageRecord, error: msgError } = await dbAdmin
      .from('messages')
      .insert(messageInsertData)
      .select()
      .maybeSingle();

    if (msgError) {
      console.error('Error inserting sent message into DB:', msgError);
      if (outboxDocId) {
        await OutboxService.markReconciliationRequired(
          outboxDocId,
          accountId,
          waMessageId,
          msgError.message
        );
      }
      return NextResponse.json(
        {
          success: true,
          status: 'sent_meta_reconciliation_pending',
          message_id: waMessageId,
          whatsapp_message_id: waMessageId,
          conversation_id,
          message: 'Message sent to Meta successfully.',
        },
        { status: 200 }
      );
    }

    // Update outbox to sent state
    if (outboxDocId) {
      await OutboxService.markSent(outboxDocId, accountId, waMessageId);
    }

    // Update conversation
    await dbAdmin
      .from('conversations')
      .update({
        last_message_text: content_text || `[${message_type}]`,
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversation_id);

    // Pause any active Flow run for this contact — the agent stepping
    // in is the strongest "yield, human is here" signal. See PR #2
    // plan for why we pause (not end): preserves diagnostic state +
    // lets the agent or the 24h timeout sweep cleanly resolve the
    // run later. For accounts with no active runs the UPDATE matches
    // zero rows — cheap and harmless.
    if (contactId) {
      try {
        const { error: pauseErr } = await dbAdmin
          .from('flow_runs')
          .update({
            status: 'paused_by_agent',
            endedAt: new Date().toISOString(),
            endReason: 'agent_replied',
          })
          .eq('accountId', accountId)
          .eq('contactId', contactId)
          .eq('status', 'active');
        if (pauseErr) {
          // Best-effort — log + continue. The agent's message already
          // landed at Meta; don't fail the response over a bookkeeping
          // miss. Worst case: a stale active run gets caught by the
          // stale-run cron sweep within 24h.
          console.error(
            '[flows] pause-on-agent-send failed:',
            pauseErr.message
          );
        }
      } catch (err) {
        console.error(
          '[flows] pause-on-agent-send threw:',
          err instanceof Error ? err.message : err
        );
      }
    }

    return NextResponse.json({
      success: true,
      message_id: messageRecord.id,
      whatsapp_message_id: waMessageId,
      conversation_id: conversation_id,
    });
  } catch (error) {
    console.error('Error in WhatsApp send POST:', error);
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    );
  }
}
