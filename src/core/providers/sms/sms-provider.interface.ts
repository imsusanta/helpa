import { MessageEvent } from '../../types';

export interface SmsProvider {
  readonly providerName: 'twilio' | 'exotel';

  verifyWebhook(request: Request, bodyText: string): Promise<boolean>;
  normalizeWebhook(payload: Record<string, unknown>): Promise<MessageEvent>;

  sendText(
    clinicId: string,
    recipientPhone: string,
    text: string
  ): Promise<{ externalMessageId: string }>;
  getDeliveryStatus(
    clinicId: string,
    externalMessageId: string
  ): Promise<{ status: string }>;
  processOptOut(clinicId: string, recipientPhone: string): Promise<boolean>;
}
