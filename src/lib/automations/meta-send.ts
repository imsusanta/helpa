import { getAdminClient } from '@/lib/db/server';
import {
  persistOutboundMessage,
  touchConversationPreview,
  outboundPreviewText,
} from '@/lib/whatsapp/persist-outbound-message';
import {
  sendTextMessage,
  sendMediaMessage,
  sendInteractiveButtons,
  sendInteractiveList,
  sendTemplateMessage,
  type MediaKind,
} from '@/lib/whatsapp/meta-api';
import { decrypt } from '@/lib/whatsapp/encryption';
import {
  sanitizePhoneForMeta,
  phoneVariants,
  isRecipientNotAllowedError,
} from '@/lib/whatsapp/phone-utils';
import {
  isExplicitLabReportRequest,
  isLikelyAiLabReportDocument,
} from '@/lib/whatsapp/report-delivery-guard';
import { classifyWhatsAppProvider } from '@/core/whatsapp/canonical-config';
import { EvolutionGoProvider } from '@/core/providers/whatsapp/evolution-go-provider';
import { WahaWhatsAppProvider } from '@/core/providers/whatsapp/waha-provider';
import { UnsupportedWhatsAppOperationError } from '@/core/providers/whatsapp/whatsapp-provider.interface';

interface SendTextArgs {
  accountId: string;
  userId?: string;
  conversationId: string;
  contactId?: string;
  text: string;
  replyToMessageId?: string | null;
  createdAt?: string;
}
interface SendButtonsArgs {
  accountId: string;
  userId?: string;
  conversationId: string;
  contactId?: string;
  bodyText: string;
  buttons: { id: string; title: string }[];
  headerText?: string;
  footerText?: string;
  replyToMessageId?: string | null;
  createdAt?: string;
}
interface SendTemplateArgs {
  accountId: string;
  userId?: string;
  conversationId: string;
  contactId?: string;
  templateName: string;
  language?: string;
  params?: string[];
}
type DocumentDeliveryIntent = 'staff_initiated' | 'patient_requested';
interface SendDocumentArgs {
  accountId: string;
  userId?: string;
  conversationId: string;
  contactId?: string;
  documentUrl: string;
  filename?: string;
  caption?: string;
  deliveryIntent?: DocumentDeliveryIntent;
  replyToMessageId?: string | null;
  createdAt?: string;
}
interface ResolvedCredentials {
  phoneNumberId: string;
  accessToken: string;
  phone: string;
  providerKind: 'meta' | 'evolution' | 'waha';
}

async function assertLabReportDeliveryAllowed(
  args: SendDocumentArgs
): Promise<void> {
  if (
    args.deliveryIntent ||
    !isLikelyAiLabReportDocument({
      filename: args.filename,
      caption: args.caption,
    })
  )
    return;
  const db = getAdminClient();
  const { data: recentMessages, error } = await db
    .from('messages')
    .select('sender_type, content_text, created_at')
    .eq('conversation_id', args.conversationId)
    .order('created_at', { ascending: false })
    .limit(10);
  if (error)
    throw new Error(
      '[meta-send] Lab report delivery blocked because patient intent could not be verified.'
    );
  const latestCustomerMessage = (recentMessages || []).find(
    (message: Record<string, unknown>) =>
      String(message.sender_type || '') === 'customer'
  );
  const messageText = String(latestCustomerMessage?.content_text || '');
  if (!isExplicitLabReportRequest(messageText))
    throw new Error(
      '[meta-send] Blocked unsolicited lab report delivery: the patient did not explicitly request a report.'
    );
}

async function resolveCredentialsAndPhone(
  accountId: string,
  contactId?: string,
  conversationId?: string
): Promise<ResolvedCredentials | null> {
  const db = getAdminClient();
  let config: Record<string, unknown> | null = null;
  try {
    const { data } = await db
      .from('whatsapp_configs')
      .select('*')
      .eq('account_id', accountId)
      .eq('status', 'connected')
      .maybeSingle();
    if (data) config = data as Record<string, unknown>;
  } catch {}
  if (!config) {
    try {
      const { data } = await db
        .from('whatsapp_configs')
        .select('*')
        .eq('account_id', accountId)
        .order('created_at', { ascending: false })
        .limit(1);
      if (data?.length) config = data[0] as Record<string, unknown>;
    } catch {}
  }
  if (!config) {
    try {
      const { data } = await db
        .from('whatsapp_config')
        .select('*')
        .eq('account_id', accountId)
        .eq('status', 'connected')
        .maybeSingle();
      if (data) config = data as Record<string, unknown>;
    } catch {}
  }
  if (!config) {
    try {
      const { data } = await db
        .from('whatsapp_config')
        .select('*')
        .eq('account_id', accountId)
        .order('created_at', { ascending: false })
        .limit(1);
      if (data?.length) config = data[0] as Record<string, unknown>;
    } catch {}
  }
  if (!config) {
    try {
      const { data } = await db
        .from('whatsapp_config')
        .select('*')
        .eq('accountId', accountId)
        .limit(1);
      if (data?.length) config = data[0] as Record<string, unknown>;
    } catch {}
  }
  if (!config) return null;
  const providerKind = classifyWhatsAppProvider(
    (config as Record<string, unknown>).provider
  );
  if (providerKind === 'unknown') return null;
  const rawPhoneNumberId = String(
    config.phone_number_id || config.phoneNumberId || config.phone_number || ''
  );
  const rawEncryptedToken = String(
    (providerKind === 'evolution'
      ? (config as Record<string, unknown>).provider_token_encrypted ||
        (config as Record<string, unknown>).providerTokenEncrypted
      : '') ||
      config.access_token_encrypted ||
      config.encrypted_access_token ||
      config.accessTokenEncrypted ||
      config.access_token ||
      config.accessToken ||
      ''
  );
  if (!rawPhoneNumberId || !rawEncryptedToken) return null;
  let accessToken = rawEncryptedToken;
  try {
    if (rawEncryptedToken.includes(':'))
      accessToken = decrypt(rawEncryptedToken);
  } catch {}
  let phone = '';
  if (contactId) {
    try {
      const { data: contact } = await db
        .from('contacts')
        .select('phone')
        .eq('id', contactId)
        .maybeSingle();
      if (contact?.phone) phone = String(contact.phone);
    } catch {}
  }
  if (!phone && conversationId) {
    try {
      const { data: conv } = await db
        .from('conversations')
        .select('contact_id, contact:contacts(phone)')
        .eq('id', conversationId)
        .maybeSingle();
      const contactObj = conv?.contact as { phone?: string } | null;
      if (contactObj?.phone) phone = String(contactObj.phone);
      else if (conv?.contact_id) {
        const { data: c } = await db
          .from('contacts')
          .select('phone')
          .eq('id', conv.contact_id)
          .maybeSingle();
        if (c?.phone) phone = String(c.phone);
      }
    } catch {}
  }
  if (!phone) return null;
  return {
    phoneNumberId: rawPhoneNumberId,
    accessToken,
    phone,
    providerKind,
  };
}

async function recordSentMessage(
  accountId: string,
  conversationId: string,
  metaMessageId: string | null,
  contentType: 'text' | 'document' | 'interactive' | 'template',
  contentText: string | null,
  mediaUrl: string | null,
  extras?: { replyToMessageId?: string | null; createdAt?: string }
): Promise<string> {
  const fallbackId = `bot-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const messageId = metaMessageId || fallbackId;
  try {
    const persistRes = await persistOutboundMessage({
      accountId,
      conversationId,
      // Live `messages` accepts the staff persist path (`agent`). `bot` is
      // mapped to outbound in the inbox anyway, and a sender_type check that
      // rejects `bot` was dropping AI rows after Meta already sent them.
      senderType: 'agent',
      contentType,
      contentText,
      mediaUrl,
      providerMessageId: messageId,
      replyToMessageId: extras?.replyToMessageId,
      createdAt: extras?.createdAt,
    });
    if (!persistRes.ok) {
      console.error(
        '[meta-send] Failed to persist outbound message:',
        persistRes.error
      );
      return messageId;
    }

    try {
      await touchConversationPreview({
        accountId,
        conversationId,
        previewText: outboundPreviewText({
          contentText,
          contentType,
        }),
      });
    } catch (err) {
      console.warn(
        '[meta-send] Conversation preview update failed:',
        err instanceof Error ? err.message : err
      );
    }

    return persistRes.messageId || messageId;
  } catch (err) {
    console.error('[meta-send] Failed to record message in database:', err);
    return messageId;
  }
}

export async function engineSendText(
  args: SendTextArgs
): Promise<{ whatsapp_message_id: string }> {
  const creds = await resolveCredentialsAndPhone(
    args.accountId,
    args.contactId,
    args.conversationId
  );
  if (!creds)
    throw new Error(
      '[meta-send] Cannot send text: WhatsApp credentials or recipient phone are unavailable.'
    );
  let metaMessageId: string | null = null;
  let lastSendError: Error | null = null;
  if (creds.providerKind === 'evolution' || creds.providerKind === 'waha') {
    const outbound =
      creds.providerKind === 'evolution'
        ? new EvolutionGoProvider({
            accountId: args.accountId,
            instanceToken: creds.accessToken,
          })
        : new WahaWhatsAppProvider();
    const result = await outbound.sendText(
      args.accountId,
      creds.phone,
      args.text
    );
    metaMessageId = result.externalMessageId;
  } else {
    const variants = phoneVariants(sanitizePhoneForMeta(creds.phone));
    for (const variant of variants) {
      try {
        const result = await sendTextMessage({
          phoneNumberId: creds.phoneNumberId,
          accessToken: creds.accessToken,
          to: variant,
          text: args.text,
        });
        metaMessageId = result.messageId;
        break;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        lastSendError = err instanceof Error ? err : new Error(msg);
        if (!isRecipientNotAllowedError(msg)) {
          console.warn('[meta-send] sendTextMessage error:', msg);
          break;
        }
      }
    }
  }
  if (!metaMessageId)
    throw (
      lastSendError ||
      new Error('[meta-send] Meta did not return a WhatsApp message ID.')
    );
  await recordSentMessage(
    args.accountId,
    args.conversationId,
    metaMessageId,
    'text',
    args.text,
    null,
    {
      replyToMessageId: args.replyToMessageId,
      createdAt: args.createdAt,
    }
  );
  return { whatsapp_message_id: metaMessageId };
}

export async function engineSendDocument(
  args: SendDocumentArgs
): Promise<{ whatsapp_message_id: string }> {
  await assertLabReportDeliveryAllowed(args);
  const creds = await resolveCredentialsAndPhone(
    args.accountId,
    args.contactId,
    args.conversationId
  );
  if (
    creds &&
    (creds.providerKind === 'evolution' || creds.providerKind === 'waha') &&
    args.documentUrl
  ) {
    const outbound =
      creds.providerKind === 'evolution'
        ? new EvolutionGoProvider({
            accountId: args.accountId,
            instanceToken: creds.accessToken,
          })
        : new WahaWhatsAppProvider();
    const result = await outbound.sendMedia(
      args.accountId,
      creds.phone,
      args.documentUrl,
      'document',
      args.caption
    );
    await recordSentMessage(
      args.accountId,
      args.conversationId,
      result.externalMessageId,
      'document',
      args.caption || args.filename || '[Document]',
      args.documentUrl,
      {
        replyToMessageId: args.replyToMessageId,
        createdAt: args.createdAt,
      }
    );
    return { whatsapp_message_id: result.externalMessageId };
  }
  let metaMessageId: string | null = null;
  if (creds && args.documentUrl) {
    for (const variant of phoneVariants(sanitizePhoneForMeta(creds.phone))) {
      try {
        const result = await sendMediaMessage({
          phoneNumberId: creds.phoneNumberId,
          accessToken: creds.accessToken,
          to: variant,
          kind: 'document',
          link: args.documentUrl,
          caption: args.caption || undefined,
          filename: args.filename || 'Document.pdf',
        });
        metaMessageId = result.messageId;
        break;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!isRecipientNotAllowedError(msg)) {
          console.warn('[meta-send] sendMediaMessage error:', msg);
          break;
        }
      }
    }
  }
  if (!metaMessageId)
    throw new Error(
      '[meta-send] Meta did not return a WhatsApp message ID for document.'
    );
  await recordSentMessage(
    args.accountId,
    args.conversationId,
    metaMessageId,
    'document',
    args.caption || args.filename || '[Document]',
    args.documentUrl,
    {
      replyToMessageId: args.replyToMessageId,
      createdAt: args.createdAt,
    }
  );
  return { whatsapp_message_id: metaMessageId };
}

export async function engineSendButtons(
  args: SendButtonsArgs
): Promise<{ whatsapp_message_id: string }> {
  const creds = await resolveCredentialsAndPhone(
    args.accountId,
    args.contactId,
    args.conversationId
  );
  if (
    creds &&
    (creds.providerKind === 'evolution' || creds.providerKind === 'waha')
  ) {
    if (creds.providerKind === 'evolution' && args.buttons?.length) {
      try {
        const outbound = new EvolutionGoProvider({
          accountId: args.accountId,
          instanceToken: creds.accessToken,
        });
        const result = await outbound.sendButtons(
          args.accountId,
          creds.phone,
          args.bodyText,
          args.buttons,
          args.headerText,
          args.footerText
        );
        await recordSentMessage(
          args.accountId,
          args.conversationId,
          result.externalMessageId,
          'interactive',
          args.bodyText,
          null,
          {
            replyToMessageId: args.replyToMessageId,
            createdAt: args.createdAt,
          }
        );
        return { whatsapp_message_id: result.externalMessageId };
      } catch (error) {
        console.warn(
          '[meta-send] Evolution button send failed, falling back to numbered text:',
          error instanceof Error ? error.message : error
        );
      }
    }
    const lines = [
      args.bodyText,
      ...args.buttons.map((button, index) => `${index + 1}. ${button.title}`),
    ].join('\n');
    return engineSendText({
      accountId: args.accountId,
      userId: args.userId,
      conversationId: args.conversationId,
      contactId: args.contactId,
      text: lines,
      replyToMessageId: args.replyToMessageId,
      createdAt: args.createdAt,
    });
  }
  let metaMessageId: string | null = null;
  if (creds && args.buttons?.length) {
    for (const variant of phoneVariants(sanitizePhoneForMeta(creds.phone))) {
      try {
        const result = await sendInteractiveButtons({
          phoneNumberId: creds.phoneNumberId,
          accessToken: creds.accessToken,
          to: variant,
          bodyText: args.bodyText,
          headerText: args.headerText,
          footerText: args.footerText,
          buttons: args.buttons.map((b) => ({
            id: b.id,
            title: b.title.substring(0, 20),
          })),
        });
        metaMessageId = result.messageId;
        break;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!isRecipientNotAllowedError(msg)) {
          console.warn('[meta-send] sendInteractiveButtons error:', msg);
          break;
        }
      }
    }
  }
  if (!metaMessageId)
    throw new Error(
      '[meta-send] Meta did not return a WhatsApp message ID for interactive buttons.'
    );
  await recordSentMessage(
    args.accountId,
    args.conversationId,
    metaMessageId,
    'interactive',
    args.bodyText,
    null,
    {
      replyToMessageId: args.replyToMessageId,
      createdAt: args.createdAt,
    }
  );
  return { whatsapp_message_id: metaMessageId };
}

export async function engineSendTemplate(
  args: SendTemplateArgs
): Promise<{ whatsapp_message_id: string }> {
  const creds = await resolveCredentialsAndPhone(
    args.accountId,
    args.contactId,
    args.conversationId
  );
  if (creds?.providerKind === 'evolution') {
    throw new UnsupportedWhatsAppOperationError(
      'evolution',
      'sendTemplate',
      'Meta-approved WhatsApp templates are not available on a QR linked-device connection.'
    );
  }
  let metaMessageId: string | null = null;
  if (creds) {
    for (const variant of phoneVariants(sanitizePhoneForMeta(creds.phone))) {
      try {
        const result = await sendTemplateMessage({
          phoneNumberId: creds.phoneNumberId,
          accessToken: creds.accessToken,
          to: variant,
          templateName: args.templateName,
          language: args.language || 'en_US',
          params: args.params || [],
        });
        metaMessageId = result.messageId;
        break;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!isRecipientNotAllowedError(msg)) {
          console.warn('[meta-send] sendTemplateMessage error:', msg);
          break;
        }
      }
    }
  }
  if (!metaMessageId)
    throw new Error(
      '[meta-send] Meta did not return a WhatsApp message ID for template.'
    );
  await recordSentMessage(
    args.accountId,
    args.conversationId,
    metaMessageId,
    'template',
    `[Template: ${args.templateName}]`,
    null
  );
  return { whatsapp_message_id: metaMessageId };
}

interface SendMediaArgs {
  accountId: string;
  userId?: string;
  conversationId: string;
  contactId?: string;
  kind: string;
  link: string;
  caption?: string;
  filename?: string;
}
export async function engineSendMedia(
  args: SendMediaArgs
): Promise<{ whatsapp_message_id: string }> {
  const creds = await resolveCredentialsAndPhone(
    args.accountId,
    args.contactId,
    args.conversationId
  );
  const kind: MediaKind =
    args.kind === 'image' ||
    args.kind === 'video' ||
    args.kind === 'audio' ||
    args.kind === 'document'
      ? args.kind
      : 'document';
  if (
    creds &&
    (creds.providerKind === 'evolution' || creds.providerKind === 'waha') &&
    args.link
  ) {
    const outbound =
      creds.providerKind === 'evolution'
        ? new EvolutionGoProvider({
            accountId: args.accountId,
            instanceToken: creds.accessToken,
          })
        : new WahaWhatsAppProvider();
    const result = await outbound.sendMedia(
      args.accountId,
      creds.phone,
      args.link,
      kind,
      args.caption
    );
    await recordSentMessage(
      args.accountId,
      args.conversationId,
      result.externalMessageId,
      kind === 'document' ? 'document' : 'text',
      args.caption || null,
      args.link
    );
    return { whatsapp_message_id: result.externalMessageId };
  }
  let metaMessageId: string | null = null;
  if (creds && args.link) {
    for (const variant of phoneVariants(sanitizePhoneForMeta(creds.phone))) {
      try {
        const result = await sendMediaMessage({
          phoneNumberId: creds.phoneNumberId,
          accessToken: creds.accessToken,
          to: variant,
          kind,
          link: args.link,
          caption: args.caption,
          filename: args.filename,
        });
        metaMessageId = result.messageId;
        break;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!isRecipientNotAllowedError(msg)) {
          console.warn('[meta-send] sendMediaMessage error:', msg);
          break;
        }
      }
    }
  }
  if (!metaMessageId)
    throw new Error(
      '[meta-send] Meta did not return a WhatsApp message ID for media.'
    );
  await recordSentMessage(
    args.accountId,
    args.conversationId,
    metaMessageId,
    'document',
    args.caption || `[${kind}]`,
    args.link
  );
  return { whatsapp_message_id: metaMessageId };
}

interface SendListArgs {
  accountId: string;
  userId?: string;
  conversationId: string;
  contactId?: string;
  bodyText: string;
  buttonLabel: string;
  sections: Array<{
    title?: string;
    rows: Array<{ id: string; title: string; description?: string }>;
  }>;
  headerText?: string;
  footerText?: string;
}
export async function engineSendInteractiveList(
  args: SendListArgs
): Promise<{ whatsapp_message_id: string }> {
  const creds = await resolveCredentialsAndPhone(
    args.accountId,
    args.contactId,
    args.conversationId
  );
  if (
    creds &&
    (creds.providerKind === 'evolution' || creds.providerKind === 'waha')
  ) {
    const lines = [args.headerText, args.bodyText, args.footerText].filter(
      Boolean
    ) as string[];
    for (const section of args.sections || []) {
      if (section.title) lines.push(section.title);
      for (const row of section.rows) {
        lines.push(
          row.description
            ? `- ${row.title}: ${row.description}`
            : `- ${row.title}`
        );
      }
    }
    return engineSendText({
      accountId: args.accountId,
      userId: args.userId,
      conversationId: args.conversationId,
      contactId: args.contactId,
      text: lines.join('\n'),
    });
  }
  let metaMessageId: string | null = null;
  if (creds && args.sections?.length) {
    for (const variant of phoneVariants(sanitizePhoneForMeta(creds.phone))) {
      try {
        const result = await sendInteractiveList({
          phoneNumberId: creds.phoneNumberId,
          accessToken: creds.accessToken,
          to: variant,
          bodyText: args.bodyText,
          buttonLabel: args.buttonLabel,
          headerText: args.headerText,
          footerText: args.footerText,
          sections: args.sections,
        });
        metaMessageId = result.messageId;
        break;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!isRecipientNotAllowedError(msg)) {
          console.warn('[meta-send] sendInteractiveList error:', msg);
          break;
        }
      }
    }
  }
  if (!metaMessageId)
    throw new Error(
      '[meta-send] Meta did not return a WhatsApp message ID for interactive list.'
    );
  await recordSentMessage(
    args.accountId,
    args.conversationId,
    metaMessageId,
    'interactive',
    args.bodyText,
    null
  );
  return { whatsapp_message_id: metaMessageId };
}
