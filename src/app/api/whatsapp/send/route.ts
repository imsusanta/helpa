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
import {
  persistOutboundMessage,
  touchConversationPreview,
  pauseActiveFlowRuns,
  outboundPreviewText,
} from '@/lib/whatsapp/persist-outbound-message';

export async function POST(request: Request) {
  try {
    const ctx = await requireRole('agent');
    const user = { id: ctx.userId };
    const accountId = ctx.accountId;
    const limit = await checkRateLimit(`send:${user.id}`, RATE_LIMITS.send);
    if (!limit.success) return rateLimitResponse(limit);

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
        try {
          const { data } = await dbAdmin
            .from('contacts')
            .select('id')
            .eq('id', contactIdInput)
            .eq('accountId', accountId)
            .maybeSingle();
          if (data) verifiedContact = data;
        } catch {}
      }
      if (!verifiedContact)
        return NextResponse.json(
          { error: 'Contact not found or access denied' },
          { status: 404 }
        );
    }

    const effectiveIdempotencyKey =
      idempotencyKey ||
      `send_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;

    if (!conversation_id && (contactIdInput || phoneInput)) {
      let resolvedContactId = contactIdInput;
      if (!resolvedContactId && phoneInput) {
        const rawPhone = String(phoneInput).trim();
        const cleanPhone =
          sanitizePhoneForMeta(rawPhone) || rawPhone.replace(/\D/g, '');
        const plusPhone = rawPhone.startsWith('+')
          ? rawPhone
          : `+${cleanPhone}`;
        const variants = [
          ...new Set([cleanPhone, plusPhone, rawPhone].filter(Boolean)),
        ];
        let foundContact: { id: string } | null = null;
        for (const variant of variants) {
          for (const phoneField of ['phone', 'phone_normalized']) {
            try {
              const { data } = await dbAdmin
                .from('contacts')
                .select('id')
                .eq('account_id', accountId)
                .eq(phoneField, variant)
                .limit(1);
              if (data?.[0]) {
                foundContact = data[0];
                break;
              }
            } catch {
              try {
                const { data } = await dbAdmin
                  .from('contacts')
                  .select('id')
                  .eq('accountId', accountId)
                  .eq(phoneField, variant)
                  .limit(1);
                if (data?.[0]) {
                  foundContact = data[0];
                  break;
                }
              } catch {}
            }
          }
          if (foundContact) break;
        }
        if (foundContact) {
          resolvedContactId = foundContact.id;
        } else {
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
            if (newContact) resolvedContactId = newContact.id;
          } catch (err) {
            console.error('[whatsapp/send] Contact insert failed:', err);
            try {
              const { data: newContact } = await dbAdmin
                .from('contacts')
                .insert({
                  accountId,
                  userId: ctx.userId,
                  phone: plusPhone,
                  name: body.name || cleanPhone || rawPhone,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                })
                .select('id')
                .single();
              if (newContact) resolvedContactId = newContact.id;
            } catch {}
          }
        }
      }
      if (resolvedContactId) {
        const findConversationForContact = async (): Promise<{
          id: string;
        } | null> => {
          try {
            const { data } = await dbAdmin
              .from('conversations')
              .select('id')
              .eq('contact_id', resolvedContactId)
              .eq('account_id', accountId)
              .eq('channel', 'whatsapp')
              .order('updated_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            if (data) return data;
          } catch {}
          try {
            const { data } = await dbAdmin
              .from('conversations')
              .select('id')
              .eq('contactId', resolvedContactId)
              .eq('accountId', accountId)
              .order('updatedAt', { ascending: false })
              .limit(1)
              .maybeSingle();
            if (data) return data;
          } catch {}
          return null;
        };
        let extConv = await findConversationForContact();
        if (!extConv) {
          const now = new Date().toISOString();
          try {
            const { data } = await dbAdmin
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
            if (data) extConv = data;
          } catch {
            try {
              const { data } = await dbAdmin
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
              if (data) extConv = data;
            } catch {}
          }
          if (!extConv) extConv = await findConversationForContact();
        }
        if (extConv) conversation_id = extConv.id;
      }
    }

    if (!conversation_id)
      return NextResponse.json(
        { error: 'Could not resolve conversation for recipient' },
        { status: 400 }
      );

    const MEDIA_KINDS = ['image', 'video', 'document', 'audio'] as const;
    const isMediaKind = (MEDIA_KINDS as readonly string[]).includes(
      message_type
    );
    const VALID_MESSAGE_TYPES = ['text', 'template', ...MEDIA_KINDS] as const;
    if (!(VALID_MESSAGE_TYPES as readonly string[]).includes(message_type))
      return NextResponse.json(
        {
          error: `Invalid message_type "${message_type}". Supported types: ${VALID_MESSAGE_TYPES.join(', ')}`,
        },
        { status: 400 }
      );
    if (message_type === 'text' && !content_text)
      return NextResponse.json(
        { error: 'content_text is required for text messages' },
        { status: 400 }
      );
    if (message_type === 'template' && !template_name)
      return NextResponse.json(
        { error: 'template_name is required for template messages' },
        { status: 400 }
      );
    if (isMediaKind && !media_url)
      return NextResponse.json(
        { error: `media_url is required for ${message_type} messages` },
        { status: 400 }
      );
    if (
      isMediaKind &&
      message_type !== 'audio' &&
      typeof content_text === 'string' &&
      content_text.length > 1024
    )
      return NextResponse.json(
        { error: 'Caption exceeds the 1024-character limit' },
        { status: 400 }
      );

    let conversation: Record<string, unknown> | null = null;
    try {
      const { data } = await dbAdmin
        .from('conversations')
        .select('*, contact:contacts(*)')
        .eq('id', conversation_id)
        .eq('account_id', accountId)
        .single();
      if (
        data &&
        String(data.account_id || data.accountId || '') === String(accountId)
      )
        conversation = data;
    } catch {
      try {
        const { data } = await dbAdmin
          .from('conversations')
          .select('*, contact:contacts(*)')
          .eq('id', conversation_id)
          .eq('accountId', accountId)
          .single();
        if (
          data &&
          String(data.account_id || data.accountId || '') === String(accountId)
        )
          conversation = data;
      } catch {}
    }
    if (!conversation)
      return NextResponse.json(
        { error: 'Conversation not found or access denied' },
        { status: 404 }
      );

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
        const { data } = await dbAdmin
          .from('contacts')
          .select('phone')
          .eq('id', contactId)
          .eq('account_id', accountId)
          .single();
        if (data?.phone) contactPhone = data.phone;
      } catch {
        try {
          const { data } = await dbAdmin
            .from('contacts')
            .select('phone')
            .eq('id', contactId)
            .eq('accountId', accountId)
            .single();
          if (data?.phone) contactPhone = data.phone;
        } catch {}
      }
    }
    if (!contactPhone)
      return NextResponse.json(
        { error: 'Contact phone number not found' },
        { status: 400 }
      );

    const sanitizedPhone = sanitizePhoneForMeta(contactPhone);
    if (!isValidE164(sanitizedPhone))
      return NextResponse.json(
        { error: 'Invalid phone number format' },
        { status: 400 }
      );

    // Canonical WhatsApp config is stored by Embedded Signup/manual setup in
    // whatsapp_configs.account_id. The legacy table remains a compatibility fallback.
    // Importantly, coexistence connections use status `coexistence_connected`.
    let config: Record<string, unknown> | null = null;
    let configSource: 'whatsapp_configs' | 'whatsapp_config' | null = null;
    try {
      const { data } = await dbAdmin
        .from('whatsapp_configs')
        .select('*')
        .eq('account_id', accountId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) {
        config = data;
        configSource = 'whatsapp_configs';
      }
    } catch {}
    if (!config) {
      try {
        const { data } = await dbAdmin
          .from('whatsapp_configs')
          .select('*')
          .eq('accountId', accountId)
          .order('updatedAt', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (data) {
          config = data;
          configSource = 'whatsapp_configs';
        }
      } catch {}
    }
    if (!config) {
      try {
        const { data } = await dbAdmin
          .from('whatsapp_config')
          .select('*')
          .eq('account_id', accountId)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (data) {
          config = data;
          configSource = 'whatsapp_config';
        }
      } catch {}
    }
    if (!config) {
      try {
        const { data } = await dbAdmin
          .from('whatsapp_config')
          .select('*')
          .eq('accountId', accountId)
          .order('updatedAt', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (data) {
          config = data;
          configSource = 'whatsapp_config';
        }
      } catch {}
    }
    if (!config)
      return NextResponse.json(
        {
          error:
            'WhatsApp not configured. Please set up your WhatsApp integration first.',
        },
        { status: 400 }
      );
    if (String(config.status || '').toLowerCase() === 'disconnected')
      return NextResponse.json(
        {
          error:
            'WhatsApp is disconnected. Please reconnect your WhatsApp integration.',
        },
        { status: 400 }
      );

    const encryptedToken = String(
      config.encrypted_access_token ||
        config.access_token_encrypted ||
        config.encryptedAccessToken ||
        config.access_token ||
        config.accessToken ||
        ''
    );
    let accessToken: string;
    try {
      accessToken = decrypt(encryptedToken);
    } catch (err) {
      console.error('[whatsapp/send] Access token decryption failed:', err);
      return NextResponse.json(
        {
          error:
            'WhatsApp Access Token decryption failed. Please reconnect WhatsApp in Settings → WhatsApp Integration.',
        },
        { status: 400 }
      );
    }

    if (isLegacyFormat(encryptedToken) && config.id) {
      try {
        const upgraded = encrypt(accessToken);
        if (configSource === 'whatsapp_configs')
          await dbAdmin
            .from('whatsapp_configs')
            .update({ encrypted_access_token: upgraded })
            .eq('id', String(config.id))
            .eq('account_id', accountId);
        if (configSource === 'whatsapp_config')
          await dbAdmin
            .from('whatsapp_config')
            .update({ access_token: upgraded })
            .eq('id', String(config.id))
            .eq('account_id', accountId);
      } catch (err) {
        console.warn('[whatsapp/send] access-token GCM upgrade failed:', err);
      }
    }

    let contextMessageId: string | undefined;
    if (reply_to_message_id) {
      const { data: parent, error: parentError } = await dbAdmin
        .from('messages')
        .select('*')
        .eq('id', reply_to_message_id)
        .maybeSingle();
      const parentConvId = parent?.conversation_id || parent?.conversationId;
      const parentAcct = parent?.account_id ?? parent?.accountId ?? '';
      if (
        parentError ||
        !parent ||
        (parentAcct && String(parentAcct) !== String(accountId)) ||
        parentConvId !== conversation_id
      )
        return NextResponse.json(
          { error: 'reply_to_message_id not found in this conversation' },
          { status: 400 }
        );
      contextMessageId = parent.message_id || parent.messageId || undefined;
    }

    let templateRow: MessageTemplate | null = null;
    if (message_type === 'template' && template_name) {
      const { data } = await dbAdmin
        .from('message_templates')
        .select('*')
        .eq('account_id', accountId)
        .eq('name', template_name)
        .eq('language', template_language || 'en_US')
        .maybeSingle();
      if (data && !isMessageTemplate(data))
        return NextResponse.json(
          {
            error:
              'Template row is malformed locally — run "Sync from Meta" in Settings to repair it.',
          },
          { status: 500 }
        );
      templateRow = data ?? null;
    }

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
    const outboxRes = await OutboxService.createPreSendOutbox({
      accountId,
      idempotencyKey: effectiveIdempotencyKey,
      requestHash,
      channel: 'whatsapp',
      conversationId: conversation_id,
      contactId: contactId || null,
      provider: 'meta',
      messageType: message_type,
      messageSnapshot: {
        contentType: message_type,
        contentText: content_text || null,
        mediaUrl: media_url || null,
        templateName: template_name || null,
        replyToMessageId: reply_to_message_id || null,
        senderId: user.id,
      },
    });
    if (!outboxRes.ok)
      return NextResponse.json(
        {
          error: outboxRes.code,
          message: outboxRes.message,
          correlationId: crypto.randomUUID(),
        },
        { status: outboxRes.code === 'IDEMPOTENCY_CONFLICT' ? 409 : 503 }
      );
    if (outboxRes.status === 'existing') {
      if (outboxRes.existingStatus === 'sent')
        return NextResponse.json({
          success: true,
          message_id: outboxRes.providerMessageId || outboxRes.outboxId,
          idempotent: true,
        });
      if (
        outboxRes.existingStatus === 'processing' ||
        outboxRes.existingStatus === 'pending'
      )
        return NextResponse.json(
          {
            error: 'DUPLICATE_REQUEST_IN_PROGRESS',
            status: 'processing',
            message: 'Message send request already in progress',
          },
          { status: 202 }
        );
      if (outboxRes.existingStatus === 'reconciliation_required')
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

    let waMessageId = '';
    let workingPhone = sanitizedPhone;
    let lastSendError: Error | null = null;
    const phoneNumberId = String(
      config.phone_number_id || config.phoneNumberId || ''
    );
    if (!phoneNumberId || !accessToken)
      return NextResponse.json(
        {
          error:
            'WhatsApp configuration is incomplete. Please reconnect WhatsApp.',
        },
        { status: 400 }
      );

    for (const variant of phoneVariants(sanitizedPhone)) {
      try {
        let result: { messageId: string };
        if (message_type === 'text') {
          result = await sendTextMessage({
            phoneNumberId,
            accessToken,
            to: variant,
            text: content_text,
            contextMessageId,
          });
        } else if (message_type === 'template') {
          result = await sendTemplateMessage({
            phoneNumberId,
            accessToken,
            to: variant,
            templateName: template_name,
            language: template_language || 'en_US',
            params: template_message_params || template_params || [],
          });
        } else {
          result = await sendMediaMessage({
            phoneNumberId,
            accessToken,
            to: variant,
            kind: message_type as MediaKind,
            link: media_url,
            caption: content_text || undefined,
            filename,
          });
        }
        waMessageId = result.messageId;
        workingPhone = variant;
        break;
      } catch (err) {
        lastSendError = err instanceof Error ? err : new Error(String(err));
        if (!isRecipientNotAllowedError(lastSendError.message)) break;
      }
    }

    if (!waMessageId) {
      try {
        await OutboxService.markDeadLetter(
          outboxRes.outboxId,
          accountId,
          lastSendError?.message || 'Meta did not return a WhatsApp message ID.'
        );
      } catch {}
      return NextResponse.json(
        {
          error:
            lastSendError?.message ||
            'Meta did not return a WhatsApp message ID.',
        },
        { status: 400 }
      );
    }

    if (contactId && workingPhone !== sanitizedPhone) {
      try {
        await dbAdmin
          .from('contacts')
          .update({ phone: workingPhone })
          .eq('id', contactId)
          .eq('account_id', accountId);
      } catch {}
    }

    // Meta already accepted the send. The inbox reads `messages`, not the
    // outbox, so a missing local row is why outbound bubbles never appear
    // even though WhatsApp delivery succeeded.
    const persistRes = await persistOutboundMessage({
      accountId,
      conversationId: conversation_id,
      senderId: user.id,
      contentType: message_type,
      contentText: content_text || null,
      mediaUrl: media_url || null,
      templateName: template_name || null,
      providerMessageId: waMessageId,
      replyToMessageId: reply_to_message_id || null,
    });

    if (!persistRes.ok) {
      try {
        await OutboxService.markReconciliationRequired(
          outboxRes.outboxId,
          accountId,
          waMessageId,
          persistRes.error
        );
      } catch {}
      return NextResponse.json({
        success: true,
        status: 'sent_meta_reconciliation_pending',
        persist_error: persistRes.error,
        message_id: waMessageId,
        conversation_id,
        phone: workingPhone,
      });
    }

    try {
      await OutboxService.markSent(outboxRes.outboxId, accountId, waMessageId);
    } catch {}

    try {
      await touchConversationPreview({
        accountId,
        conversationId: conversation_id,
        previewText: outboundPreviewText({
          contentText: content_text,
          contentType: message_type,
        }),
      });
    } catch (err) {
      console.warn(
        '[whatsapp/send] Conversation preview update failed:',
        err instanceof Error ? err.message : err
      );
    }

    try {
      await pauseActiveFlowRuns({
        accountId,
        contactId: contactId ? String(contactId) : null,
      });
    } catch (err) {
      console.warn(
        '[whatsapp/send] Pause-on-agent-send failed:',
        err instanceof Error ? err.message : err
      );
    }

    return NextResponse.json({
      success: true,
      message_id: waMessageId,
      id: persistRes.messageId,
      conversation_id,
      phone: workingPhone,
      template_loaded: Boolean(templateRow),
    });
  } catch (error) {
    console.error('[whatsapp/send] Unhandled error:', error);
    if (error instanceof UnauthorizedError || error instanceof ForbiddenError)
      return toErrorResponse(error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
