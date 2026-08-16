import { appwriteAdmin } from '@/lib/appwrite-server-compat';
import { decrypt } from '@/lib/whatsapp/encryption';
import {
  sendInteractiveButtons,
  sendMediaMessage,
  sendTemplateMessage,
  sendTextMessage,
} from '@/lib/whatsapp/meta-api';
import {
  isRecipientNotAllowedError,
  phoneVariants,
  sanitizePhoneForMeta,
} from '@/lib/whatsapp/phone-utils';
import { messagesRepository } from '@/infrastructure/appwrite/repositories/messages.repository';

interface SendTextArgs {
  accountId: string;
  userId: string;
  conversationId: string;
  contactId: string;
  text: string;
}

interface SendButtonsArgs {
  accountId: string;
  userId: string;
  conversationId: string;
  contactId: string;
  bodyText: string;
  buttons: { id: string; title: string }[];
}

interface SendTemplateArgs {
  accountId: string;
  userId: string;
  conversationId: string;
  contactId: string;
  templateName: string;
  language?: string;
  params?: string[];
}

interface SendDocumentArgs {
  accountId: string;
  userId: string;
  conversationId: string;
  contactId: string;
  documentUrl: string;
  filename?: string;
  caption?: string;
}

type WhatsAppConfig = Record<string, unknown>;

type DeliveryContext = {
  phoneNumberId: string;
  accessToken: string;
  recipient: string;
};

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function readConfigValue(config: WhatsAppConfig, ...keys: string[]): string {
  for (const key of keys) {
    const value = readString(config[key]);
    if (value) return value;
  }
  return '';
}

async function findWhatsAppConfig(
  accountId: string
): Promise<WhatsAppConfig | null> {
  const db = appwriteAdmin();

  try {
    const { data } = await db
      .from('whatsapp_configs')
      .select('*')
      .eq('account_id', accountId)
      .maybeSingle();
    if (data) return data as WhatsAppConfig;
  } catch {
    // Try the legacy camelCase schema below.
  }

  try {
    const { data } = await db
      .from('whatsapp_configs')
      .select('*')
      .eq('accountId', accountId)
      .maybeSingle();
    return (data as WhatsAppConfig | null) ?? null;
  } catch {
    return null;
  }
}

async function findContactPhone(
  accountId: string,
  contactId: string
): Promise<string> {
  const db = appwriteAdmin();

  try {
    const { data } = await db
      .from('contacts')
      .select('phone, phone_normalized, account_id')
      .eq('id', contactId)
      .eq('account_id', accountId)
      .maybeSingle();
    const phone = readString(data?.phone) || readString(data?.phone_normalized);
    if (phone) return phone;
  } catch {
    // Try the legacy camelCase schema below.
  }

  try {
    const { data } = await db
      .from('contacts')
      .select('phone, phoneNormalized, accountId')
      .eq('id', contactId)
      .eq('accountId', accountId)
      .maybeSingle();
    const phone = readString(data?.phone) || readString(data?.phoneNormalized);
    if (phone) return phone;
  } catch {
    // Convert the missing/invalid contact into a clear delivery error.
  }

  throw new Error('Patient contact has no WhatsApp phone number.');
}

async function getDeliveryContext(
  accountId: string,
  contactId: string
): Promise<DeliveryContext> {
  const config = await findWhatsAppConfig(accountId);
  if (!config) {
    throw new Error(
      'WhatsApp is not configured for this clinic. Connect the Meta WhatsApp number in Settings.'
    );
  }

  const phoneNumberId = readConfigValue(
    config,
    'phone_number_id',
    'phoneNumberId'
  );
  const encryptedToken = readConfigValue(
    config,
    'encrypted_access_token',
    'encryptedAccessToken',
    'access_token',
    'accessToken'
  );

  if (!phoneNumberId || !encryptedToken) {
    throw new Error(
      'WhatsApp configuration is incomplete. Save the phone number ID and access token again.'
    );
  }

  let accessToken: string;
  try {
    accessToken = decrypt(encryptedToken);
  } catch {
    throw new Error(
      'WhatsApp access-token decryption failed. Re-save the Meta access token in Settings.'
    );
  }

  const rawPhone = await findContactPhone(accountId, contactId);
  const recipient = sanitizePhoneForMeta(rawPhone);
  if (!recipient) {
    throw new Error('Patient contact has an invalid WhatsApp phone number.');
  }

  return { phoneNumberId, accessToken, recipient };
}

async function sendWithPhoneVariants(
  context: DeliveryContext,
  send: (recipient: string) => Promise<string>
): Promise<string> {
  let lastError: unknown = null;

  for (const recipient of phoneVariants(context.recipient)) {
    try {
      return await send(recipient);
    } catch (error) {
      if (!isRecipientNotAllowedError(error instanceof Error ? error.message : String(error))) {
        throw error;
      }
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('WhatsApp recipient is not in the Meta allowed test list.');
}

async function persistOutboundMessage(args: {
  accountId: string;
  userId: string;
  conversationId: string;
  content: string;
  mediaUrl?: string;
  providerMessageId: string;
}): Promise<{ whatsapp_message_id: string }> {
  await messagesRepository.createMessage(args.accountId, {
    conversationId: args.conversationId,
    senderType: 'agent',
    senderId: args.userId,
    content: args.content,
    mediaUrl: args.mediaUrl,
    status: 'sent',
    providerMessageId: args.providerMessageId,
  });

  return { whatsapp_message_id: args.providerMessageId };
}

export async function engineSendText(
  args: SendTextArgs
): Promise<{ whatsapp_message_id: string }> {
  const context = await getDeliveryContext(args.accountId, args.contactId);
  const providerMessageId = await sendWithPhoneVariants(context, (to) =>
    sendTextMessage({
      phoneNumberId: context.phoneNumberId,
      accessToken: context.accessToken,
      to,
      text: args.text,
    }).then((result) => result.messageId)
  );

  return persistOutboundMessage({
    accountId: args.accountId,
    userId: args.userId,
    conversationId: args.conversationId,
    content: args.text,
    providerMessageId,
  });
}

export async function engineSendTemplate(
  args: SendTemplateArgs
): Promise<{ whatsapp_message_id: string }> {
  const context = await getDeliveryContext(args.accountId, args.contactId);
  const providerMessageId = await sendWithPhoneVariants(context, (to) =>
    sendTemplateMessage({
      phoneNumberId: context.phoneNumberId,
      accessToken: context.accessToken,
      to,
      templateName: args.templateName,
      language: args.language || 'en_US',
      params: args.params || [],
    }).then((result) => result.messageId)
  );

  return persistOutboundMessage({
    accountId: args.accountId,
    userId: args.userId,
    conversationId: args.conversationId,
    content: `[Template: ${args.templateName}]`,
    providerMessageId,
  });
}

export async function engineSendButtons(
  args: SendButtonsArgs
): Promise<{ whatsapp_message_id: string }> {
  const context = await getDeliveryContext(args.accountId, args.contactId);
  const providerMessageId = await sendWithPhoneVariants(context, (to) =>
    sendInteractiveButtons({
      phoneNumberId: context.phoneNumberId,
      accessToken: context.accessToken,
      to,
      bodyText: args.bodyText,
      buttons: args.buttons,
    }).then((result) => result.messageId)
  );

  return persistOutboundMessage({
    accountId: args.accountId,
    userId: args.userId,
    conversationId: args.conversationId,
    content: args.bodyText,
    providerMessageId,
  });
}

export async function engineSendDocument(
  args: SendDocumentArgs
): Promise<{ whatsapp_message_id: string }> {
  const context = await getDeliveryContext(args.accountId, args.contactId);
  const providerMessageId = await sendWithPhoneVariants(context, (to) =>
    sendMediaMessage({
      phoneNumberId: context.phoneNumberId,
      accessToken: context.accessToken,
      to,
      kind: 'document',
      link: args.documentUrl,
      filename: args.filename,
      caption: args.caption,
    }).then((result) => result.messageId)
  );

  return persistOutboundMessage({
    accountId: args.accountId,
    userId: args.userId,
    conversationId: args.conversationId,
    content: args.caption || '[Document]',
    mediaUrl: args.documentUrl,
    providerMessageId,
  });
}
