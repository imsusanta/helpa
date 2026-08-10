import { messagesRepository } from '@/infrastructure/appwrite/repositories/messages.repository';

interface SendTextEngineArgs {
  accountId: string;
  userId: string;
  conversationId: string;
  contactId: string;
  text: string;
}

export async function engineSendText(
  args: SendTextEngineArgs
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

interface SendMediaEngineArgs {
  accountId: string;
  userId: string;
  conversationId: string;
  contactId: string;
  kind: string;
  link: string;
  caption?: string;
  filename?: string;
}

export async function engineSendMedia(
  args: SendMediaEngineArgs
): Promise<{ whatsapp_message_id: string }> {
  const msg = await messagesRepository.createMessage(args.accountId, {
    conversationId: args.conversationId,
    senderType: 'bot',
    senderId: args.userId,
    content: args.caption || `[${args.kind}]`,
    mediaUrl: args.link,
    status: 'sent',
  });
  return { whatsapp_message_id: msg.$id };
}

interface SendInteractiveButtonsEngineArgs {
  accountId: string;
  userId: string;
  conversationId: string;
  contactId: string;
  bodyText: string;
  buttons: any[];
  headerText?: string;
  footerText?: string;
}

export async function engineSendInteractiveButtons(
  args: SendInteractiveButtonsEngineArgs
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

interface SendInteractiveListEngineArgs {
  accountId: string;
  userId: string;
  conversationId: string;
  contactId: string;
  bodyText: string;
  buttonLabel: string;
  sections: any[];
  headerText?: string;
  footerText?: string;
}

export async function engineSendInteractiveList(
  args: SendInteractiveListEngineArgs
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
