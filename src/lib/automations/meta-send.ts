import { appwriteAdmin } from '@/lib/appwrite-server-compat';
import {
  sendTextMessage,
  sendMediaMessage,
  sendInteractiveButtons,
  sendTemplateMessage,
} from '@/lib/whatsapp/meta-api';
import { decrypt } from '@/lib/whatsapp/encryption';
import {
  sanitizePhoneForMeta,
  phoneVariants,
  isRecipientNotAllowedError,
} from '@/lib/whatsapp/phone-utils';

interface SendTextArgs {
  accountId: string;
  userId?: string;
  conversationId: string;
  contactId?: string;
  text: string;
}

interface SendButtonsArgs {
  accountId: string;
  userId?: string;
  conversationId: string;
  contactId?: string;
  bodyText: string;
  buttons: { id: string; title: string }[];
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

interface SendDocumentArgs {
  accountId: string;
  userId?: string;
  conversationId: string;
  contactId?: string;
  documentUrl: string;
  filename?: string;
  caption?: string;
}

interface ResolvedCredentials {
  phoneNumberId: string;
  accessToken: string;
  phone: string;
}

async function resolveCredentialsAndPhone(
  accountId: string,
  contactId?: string,
  conversationId?: string
): Promise<ResolvedCredentials | null> {
  const db = appwriteAdmin();

  // 1. Fetch active WhatsApp configuration
  let config: Record<string, unknown> | null = null;
  try {
    const { data } = await db
      .from('whatsapp_config')
      .select('*')
      .eq('account_id', accountId)
      .eq('status', 'connected')
      .maybeSingle();
    if (data) config = data as Record<string, unknown>;
  } catch {
    // fallback
  }

  if (!config) {
    try {
      const { data } = await db
        .from('whatsapp_config')
        .select('*')
        .eq('account_id', accountId)
        .order('created_at', { ascending: false })
        .limit(1);
      if (data && data.length > 0) config = data[0] as Record<string, unknown>;
    } catch {
      // ignore
    }
  }

  if (!config) {
    try {
      const { data } = await db
        .from('whatsapp_config')
        .select('*')
        .eq('accountId', accountId)
        .limit(1);
      if (data && data.length > 0) config = data[0] as Record<string, unknown>;
    } catch {
      // ignore
    }
  }

  if (!config) return null;

  const rawPhoneNumberId = String(
    config.phone_number_id || config.phoneNumberId || config.phone_number || ''
  );
  const rawEncryptedToken = String(
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
    if (rawEncryptedToken.includes(':')) {
      accessToken = decrypt(rawEncryptedToken);
    }
  } catch {
    // raw token
  }

  // 2. Fetch recipient phone number
  let phone = '';
  if (contactId) {
    try {
      const { data: contact } = await db
        .from('contacts')
        .select('phone')
        .eq('id', contactId)
        .maybeSingle();
      if (contact?.phone) phone = String(contact.phone);
    } catch {
      // ignore
    }
  }

  if (!phone && conversationId) {
    try {
      const { data: conv } = await db
        .from('conversations')
        .select('contact_id, contact:contacts(phone)')
        .eq('id', conversationId)
        .maybeSingle();
      const contactObj = conv?.contact as { phone?: string } | null;
      if (contactObj?.phone) {
        phone = String(contactObj.phone);
      } else if (conv?.contact_id) {
        const { data: c } = await db
          .from('contacts')
          .select('phone')
          .eq('id', conv.contact_id)
          .maybeSingle();
        if (c?.phone) phone = String(c.phone);
      }
    } catch {
      // ignore
    }
  }

  if (!phone) return null;

  return {
    phoneNumberId: rawPhoneNumberId,
    accessToken,
    phone,
  };
}

async function recordSentMessage(
  accountId: string,
  conversationId: string,
  metaMessageId: string | null,
  contentType: 'text' | 'document' | 'interactive' | 'template',
  contentText: string | null,
  mediaUrl: string | null
): Promise<string> {
  const db = appwriteAdmin();
  const nowIso = new Date().toISOString();
  const fallbackId = `bot-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const messageId = metaMessageId || fallbackId;

  try {
    const { data: inserted } = await db
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_type: 'bot',
        content_type: contentType,
        content_text: contentText,
        media_url: mediaUrl,
        status: 'sent',
        message_id: messageId,
        created_at: nowIso,
      })
      .select('id')
      .maybeSingle();

    try {
      await db
        .from('conversations')
        .update({
          last_message_at: nowIso,
          updated_at: nowIso,
        })
        .eq('id', conversationId);
    } catch {
      // ignore
    }

    return inserted?.id ? String(inserted.id) : messageId;
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

  let metaMessageId: string | null = null;

  if (creds) {
    const sanitized = sanitizePhoneForMeta(creds.phone);
    const variants = phoneVariants(sanitized);

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
        if (!isRecipientNotAllowedError(msg)) {
          console.warn('[meta-send] sendTextMessage error:', msg);
          break;
        }
      }
    }
  }

  const recordedId = await recordSentMessage(
    args.accountId,
    args.conversationId,
    metaMessageId,
    'text',
    args.text,
    null
  );

  return { whatsapp_message_id: metaMessageId || recordedId };
}

export async function engineSendDocument(
  args: SendDocumentArgs
): Promise<{ whatsapp_message_id: string }> {
  const creds = await resolveCredentialsAndPhone(
    args.accountId,
    args.contactId,
    args.conversationId
  );

  let metaMessageId: string | null = null;

  if (creds && args.documentUrl) {
    const sanitized = sanitizePhoneForMeta(creds.phone);
    const variants = phoneVariants(sanitized);

    for (const variant of variants) {
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
        console.log(
          `[meta-send] Document sent successfully via Meta: ${result.messageId}`
        );
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

  const recordedId = await recordSentMessage(
    args.accountId,
    args.conversationId,
    metaMessageId,
    'document',
    args.caption || args.filename || '[Document]',
    args.documentUrl
  );

  return { whatsapp_message_id: metaMessageId || recordedId };
}

export async function engineSendButtons(
  args: SendButtonsArgs
): Promise<{ whatsapp_message_id: string }> {
  const creds = await resolveCredentialsAndPhone(
    args.accountId,
    args.contactId,
    args.conversationId
  );

  let metaMessageId: string | null = null;

  if (creds && args.buttons && args.buttons.length > 0) {
    const sanitized = sanitizePhoneForMeta(creds.phone);
    const variants = phoneVariants(sanitized);

    for (const variant of variants) {
      try {
        const result = await sendInteractiveButtons({
          phoneNumberId: creds.phoneNumberId,
          accessToken: creds.accessToken,
          to: variant,
          bodyText: args.bodyText,
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

  const recordedId = await recordSentMessage(
    args.accountId,
    args.conversationId,
    metaMessageId,
    'interactive',
    args.bodyText,
    null
  );

  return { whatsapp_message_id: metaMessageId || recordedId };
}

export async function engineSendTemplate(
  args: SendTemplateArgs
): Promise<{ whatsapp_message_id: string }> {
  const creds = await resolveCredentialsAndPhone(
    args.accountId,
    args.contactId,
    args.conversationId
  );

  let metaMessageId: string | null = null;

  if (creds) {
    const sanitized = sanitizePhoneForMeta(creds.phone);
    const variants = phoneVariants(sanitized);

    for (const variant of variants) {
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

  const recordedId = await recordSentMessage(
    args.accountId,
    args.conversationId,
    metaMessageId,
    'template',
    `[Template: ${args.templateName}]`,
    null
  );

  return { whatsapp_message_id: metaMessageId || recordedId };
}
