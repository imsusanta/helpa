import { MessageEvent } from '../../types';

export interface WhatsAppProvider {
  readonly providerName: 'meta' | 'waha';

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

  getSessionHealth(
    clinicId: string
  ): Promise<{
    status: 'active' | 'degraded' | 'disconnected';
    lastCheckAt: string;
  }>;
}
