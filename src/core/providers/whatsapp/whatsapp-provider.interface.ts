import { MessageEvent } from '../../types';

export type WhatsAppProviderName = 'meta' | 'evolution' | 'waha';

export class UnsupportedWhatsAppOperationError extends Error {
  readonly code = 'UNSUPPORTED_WHATSAPP_OPERATION';
  readonly provider: WhatsAppProviderName;
  readonly operation: string;

  constructor(
    provider: WhatsAppProviderName,
    operation: string,
    message?: string
  ) {
    super(
      message ||
        `${operation} is not supported for the ${provider} WhatsApp connection.`
    );
    this.name = 'UnsupportedWhatsAppOperationError';
    this.provider = provider;
    this.operation = operation;
  }
}

export interface WhatsAppProvider {
  readonly providerName: WhatsAppProviderName;

  verifyWebhook(request: Request, bodyText: string): Promise<boolean>;
  normalizeWebhook(payload: Record<string, unknown>): Promise<MessageEvent[]>;

  sendText(
    clinicId: string,
    recipientPhone: string,
    text: string
  ): Promise<{ externalMessageId: string }>;
  sendTemplate(
    clinicId: string,
    recipientPhone: string,
    templateName: string,
    language: string,
    components?: unknown[]
  ): Promise<{ externalMessageId: string }>;
  sendMedia(
    clinicId: string,
    recipientPhone: string,
    mediaUrl: string,
    mediaType: 'image' | 'document' | 'audio' | 'video',
    caption?: string
  ): Promise<{ externalMessageId: string }>;

  getSessionHealth(clinicId: string): Promise<{
    status: 'active' | 'degraded' | 'disconnected';
    lastCheckAt: string;
  }>;
}
