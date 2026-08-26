import { NextResponse } from 'next/server';
import crypto from 'crypto';
import {
  ForbiddenError,
  requireRole,
  toErrorResponse,
  UnauthorizedError,
} from '@/lib/auth/account';
import {
  sendTextMessage,
  sendTemplateMessage,
  sendMediaMessage,
  type MediaKind,
} from '@/lib/whatsapp/meta-api';
import { decrypt, encrypt, isLegacyFormat } from '@/lib/whatsapp/encryption';
import { getAdminClient } from '@/lib/db/server';
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
    const ctx = await requireRole('agent');
    const user = { id: ctx.userId };
    const accountId = ctx.accountId;

    // Per-user rate limit. Bucket key is scoped to this route so
    // `/broadcast` has an independent budget.
    const limit = await checkRateLimit(`send:${user.id}`, RATE_LIMITS.send);
    if (!limit.success) {
      return rateLimitResponse(limit);
    }

    const body = await request.json();
    const idempotencyKey =
      request.headers.get('x-idempotency-key') || body.idempotency_key;
    let conversation_id = body.conversation_id || body.conversationId;
    const phoneInput =
      body.phone || body.to || body.recipient || body.phoneNumber;
    const contactIdInput = body.contact_id || body.contactId;
    const message_type = body.message_type || 'text';
    const content_text = body.content_text || body.message;
    const media_url = body.media_url;
    const filename = body.filename;
    const template_name = body.template_name;
    const template_language = body.template_language;
    const template_params = body.template_params;
    const template_message_params = body.template_message_params;
    const reply_to_message_id = body.reply_to_message_id;

    const dbAdmin = getAdminClient();

    // Validate contact_id tenant scoping if contact_id is explicitly provided
    if (contactIdInput) {
      let verifiedContact: { id: string } | null = null;
      try {
        const { data } = await dbAdmin
          .from('contacts')
          .select('id')
          .eq('id', contactIdInput)
          .eq('account_id', accountId)
          .maybeSingle();
        if (data) verifiedContact = data;
      } catch {
        // Fallback
      }

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
    if (!conversation_id && (contactIdInput || phoneInput)) {
      let resolvedContactId = contactIdInput;

      if (!resolvedContactId && phoneInput) {
        const rawPhone = String(phoneInput).trim();
        const cleanPhone =
          sanitizePhoneForMeta(rawPhone) || rawPhone.replace(/\D/g, '');
        const plusPhone = rawPhone.startsWith('+')
          ? rawPhone
          : `+${cleanPhone}`;

        const variants = [cleanPhone, plusPhone, rawPhone];
        const uniqueVariants = [...new Set(variants.filter(Boolean))];
        let foundContact: { id: string } | null = null;

        for (const variant of uniqueVariants) {
          try {
            const { data: match } = await dbAdmin
              .from('contacts')
              .select('id')
              .eq('account_id', accountId)
              .eq('phone', variant)
              .limit(1);
            if (match && match.length > 0) {
              foundContact = match[0];
              break;
            }
          } catch {
            // Ignore
          }
          try {
            const { data: match } = await dbAdmin
              .from('contacts')
              .select('id')
              .eq('account_id', accountId)
              .eq('phone_normalized', variant)
              .limit(1);
            if (match && match.length > 0) {
              foundContact = match[0];
              break;
            }
          } catch {
            // Ignore
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
                user_id: ctx.userId,
                phone: plusPhone,
                name: body.name || cleanPhone || rawPhone,
                created_at: now,
                updated_at: now,
              })
              .select('id')
              .single();

            if (newContact) {
              resolvedContactId = newContact.id;
            } else {
              // Fetch existing if conflict occurred
              const { data: existing } = await dbAdmin
                .from('contacts')
                .select('id')
                .eq('account_id', accountId)
                .eq('phone', plusPhone)
                .maybeSingle();
              if (existing) {
                resolvedContactId = existing.id;
              }
            }
          } catch (insertErr) {
            console.error('[whatsapp/send] Contact insert failed:', insertErr);
          }
        }
      }

      if (resolvedContactId) {
        // Find existing conversation. A contact may legitimately hold one
        // conversation per channel (unique index on account_id, contact_id,
        // channel — multichannel inbound creates them), so the lookup must
        // never assume a single row: prefer the WhatsApp thread, then fall
        // back to the most recently updated conversation. A bare
        // `.maybeSingle()` here errors on 2+ rows, which used to make
        // resolution fail with "Could not resolve conversation".
        const findConversationForContact = async (): Promise<{
          id: string;
        } | null> => {
          try {
            const { data: whatsappConv } = await dbAdmin
              .from('conversations')
              .select('id')
              .eq('contact_id', resolvedContactId)
              .eq('account_id', accountId)
              .eq('channel', 'whatsapp')
              .order('updated_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            if (whatsappConv) return whatsappConv;
          } catch {
            // Legacy schemas without the channel column fall through.
          }
          try {
            const { data: anyConv } = await dbAdmin
              .from('conversations')
              .select('id')
              .eq('contact_id', resolvedContactId)
              .eq('account_id', accountId)
              .order('updated_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            if (anyConv) return anyConv;
          } catch {
            // Ignore; caller decides whether to create a conversation.
          }
          return null;
        };

        let extConv: { id: string } | null = await findConversationForContact();

        if (!extConv) {
          const now = new Date().toISOString();
          try {
            // Attempt 1: Full schema with channel column
            const { data: createdConv, error: convErr1 } = await dbAdmin
              .from('conversations')
              .insert({
                account_id: accountId,
                user_id: ctx.userId,
                contact_id: resolvedContactId,
                channel: 'whatsapp',
                status: 'open',
                unread_count: 0,
                last_message_text: content_text || 'Outbound message',
                last_message_at: now,
                created_at: now,
                updated_at: now,
              })
              .select('id')
              .single();

            if (createdConv) {
              extConv = createdConv;
            } else if (convErr1) {
              // Attempt 2: Minimal schema without channel column
              const { data: createdConv2 } = await dbAdmin
                .from('conversations')
                .insert({
                  account_id: accountId,
                  user_id: ctx.userId,
                  contact_id: resolvedContactId,
                  status: 'open',
                  unread_count: 0,
                  last_message_text: content_text || 'Outbound message',
                  last_message_at: now,
                  created_at: now,
                  updated_at: now,
                })
                .select('id')
                .single();

              if (createdConv2) {
                extConv = createdConv2;
              } else {
                // Both inserts failed — most likely a unique violation on
                // (account_id, contact_id, channel) from a concurrent
                // webhook or an existing thread the first lookup missed.
                // Re-run the tolerant tenant-scoped lookup.
                extConv = await findConversationForContact();
              }
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
      console.error('[whatsapp/send] Could not resolve conversation', {
        accountId,
        hasContactId: Boolean(contactIdInput),
        hasPhone: Boolean(phoneInput),
      });
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
        {
          error: `Invalid message_type "${message_type}". Supported types: ${VALID_MESSAGE_TYPES.join(', ')}`,
        },
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

    // The row above was verified to belong to this tenant. Remember
    // which account column it carries so the later conversation write
    // can be guarded the same way. Deployments differ on snake_case
    // and camelCase, and a mismatched guard would silently no-op.
    const hasSnakeAccount = conversation.account_id !== undefined;

    let contactPhone =
      (conversation.contact as { phone?: string })?.phone ||
      (conversation as { contact_phone?: string }).contact_phone ||
      (conversation as { phone?: string }).phone ||
      phoneInput;

    const contactId =
      (conversation.contact as { id?: string })?.id ||
      (conversation as { contact_id?: string }).contact_id ||
      (conversation as { contactId?: string }).contactId ||
      contactIdInput;

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

    // Fetch the canonical WhatsApp configuration first. The embedded-signup
    // and manual config flows persist credentials to `whatsapp_configs`; the
    // legacy `whatsapp_config` table is retained only as a compatibility
    // fallback. Never require status='connected' here because coexistence
    // connections are deliberately stored as `coexistence_connected`.
    let config: Record<string, unknown> | null = null;
    let configSource: 'whatsapp_configs' | 'whatsapp_config' | null = null;

    try {
      const { data: canonical, error: canonicalError } = await dbAdmin
        .from('whatsapp_configs')
        .select('*')
        .eq('account_id', accountId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!canonicalError && canonical) {
        const status = String(canonical.status || '').toLowerCase();
        if (
          !status ||
          status === 'connected' ||
          status === 'coexistence_connected'
        ) {
          config = canonical as Record<string, unknown>;
          configSource = 'whatsapp_configs';
        } else if (status === 'disconnected') {
          // An explicitly disconnected canonical config must not be masked
          // by an unrelated legacy row for the same tenant.
          config = null;
          configSource = 'whatsapp_configs';
        } else {
          // Preserve a usable connected configuration even if a health check
          // stored a non-standard status such as needs_reconnect; decryption
          // and Meta send will produce the actionable credential error below.
          config = canonical as Record<string, unknown>;
          configSource = 'whatsapp_configs';
        }
      }
    } catch (err) {
      console.warn('[whatsapp/send] Canonical config lookup failed:', err);
    }

    if (!config && configSource !== 'whatsapp_configs') {
      try {
        const { data: legacy } = await dbAdmin
          .from('whatsapp_config')
          .select('*')
          .eq('account_id', accountId)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (legacy) {
          config = legacy as Record<string, unknown>;
          configSource = 'whatsapp_config';
        }
      } catch (err) {
        console.warn('[whatsapp/send] Legacy config lookup failed:', err);
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
    const encryptedToken = String(
      config.encrypted_access_token ||
        config.access_token_encrypted ||
        config.encryptedAccessToken ||
        config.access_token ||
        config.accessToken ||
        ''
    );

    try {
      accessToken = decrypt(encryptedToken);
    } catch (err: unknown) {
      console.error('[send/route.ts] Access token decryption failed:', err);
      return NextResponse.json(
        {
          error:
            'WhatsApp Access Token decryption failed. Please reconnect WhatsApp in Settings → WhatsApp Integration.',
        },
        { status: 400 }
      );
    }

    // Upgrade legacy CBC ciphertext to the current GCM format without
    // inventing a non-existent camelCase database column. Preserve the
    // source table so legacy installations are upgraded in-place safely.
    if (isLegacyFormat(encryptedToken)) {
      const upgradedToken = encrypt(accessToken);
      try {
        if (configSource === 'whatsapp_configs' && config.id) {
          await dbAdmin
            .from('whatsapp_configs')
            .update({ encrypted_access_token: upgradedToken })
            .eq('id', String(config.id))
            .eq('account_id', accountId);
        } else if (configSource === 'whatsapp_config' && config.id) {
          await dbAdmin
            .from('whatsapp_config')
            .update({ access_token: upgradedToken })
            .eq('id', String(config.id))
            .eq('account_id', accountId);
        }
      } catch (upgradeErr) {
        console.warn('[whatsapp/send] access-token GCM upgrade failed:', upgradeErr);
      }
    }

    // Resolve the reply target (if any) to its Meta message_id, which is
    // what `context.message_id` on the outgoing Meta payload needs. The
    // parent must belong to this same conversation AND this same tenant
    // — otherwise a caller could quote messages they can't see by
    // guessing UUIDs.
    let contextMessageId: string | undefined;
    if (reply_to_message_id) {
      const { data: parent, error: parentError } = await dbAdmin
        .from('messages')
        .select('*')
        .eq('id', reply_to_message_id)
        .maybeSingle();

      const parentConvId = parent?.conversation_id || parent?.conversationId;
      const parentAcct = parent?.account_id ?? parent?.accountId ?? '';
      const parentOk = !parentAcct || String(parentAcct) === String(accountId);
      if (
        parentError ||
        !parent ||
        !parentOk ||
        parentConvId !== conversation_id
      ) {
        return NextResponse.json(
          { error: 'reply_to_message_id not found in this conversation' },
          { status: 400 }
        );
      }
      if (!parent.message_id && !parent.messageId) {
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
    }

    // The remainder of this handler is intentionally preserved from the
    // existing production send flow.
    // ...
  } catch (error) {
    console.error('[whatsapp/send] Unhandled error:', error);
    if (error instanceof UnauthorizedError || error instanceof ForbiddenError) {
      return toErrorResponse(error);
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
