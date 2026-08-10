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

export async function engineSendText(
  args: SendTextArgs
): Promise<{ whatsapp_message_id: string }> {
  const msg = await messagesRepository.createMessage(args.accountId, {
    conversationId: args.conversationId,
    senderType: 'bot',
    senderId: args.userId,
    content: args.text,
    status: 'sent',
  });
  return { whatsapp_message_id: msg.$id };
}

export async function engineSendTemplate(
  args: SendTemplateArgs
): Promise<{ whatsapp_message_id: string }> {
  const msg = await messagesRepository.createMessage(args.accountId, {
    conversationId: args.conversationId,
    senderType: 'bot',
    senderId: args.userId,
    content: `[Template: ${args.templateName}]`,
    status: 'sent',
  });
  return { whatsapp_message_id: msg.$id };
}

export async function engineSendButtons(
  args: SendButtonsArgs
): Promise<{ whatsapp_message_id: string }> {
  const msg = await messagesRepository.createMessage(args.accountId, {
    conversationId: args.conversationId,
    senderType: 'bot',
    senderId: args.userId,
    content: args.bodyText,
    status: 'sent',
  });
  return { whatsapp_message_id: msg.$id };
}

export async function engineSendDocument(
  args: SendDocumentArgs
): Promise<{ whatsapp_message_id: string }> {
  const msg = await messagesRepository.createMessage(args.accountId, {
    conversationId: args.conversationId,
    senderType: 'bot',
    senderId: args.userId,
    content: args.caption || '[Document]',
    mediaUrl: args.documentUrl,
    status: 'sent',
  });
  return { whatsapp_message_id: msg.$id };
}
