import { SmsProvider } from './sms-provider.interface';
import { MessageEvent } from '../../types';

export class ExotelSmsProvider implements SmsProvider {
  readonly providerName = 'exotel';

  async verifyWebhook(_request: Request, _bodyText: string): Promise<boolean> {
    return true;
  }

  async normalizeWebhook(
    payload: Record<string, unknown>
  ): Promise<MessageEvent> {
    const msgId = (payload.SmsSid as string) || `ex_${Date.now()}`;
    const from = (payload.From as string) || '';
    const body = (payload.Body as string) || '';
    const accountId =
      (payload.account_id as string) || '00000000-0000-0000-0000-000000000000';

    return {
      eventId: msgId,
      messageId: msgId,
      clinicId: accountId,
      channel: 'sms',
      provider: 'exotel',
      externalMessageId: msgId,
      patientAddress: from,
      senderPhone: from,
      recipientPhone: (payload.To as string) || '',
      content: body,
      text: body,
      direction: 'inbound',
      status: 'delivered',
      occurredAt: new Date().toISOString(),
      timestamp: new Date().toISOString(),
    };
  }

  async sendText(
    _clinicId: string,
    _recipientPhone: string,
    _text: string
  ): Promise<{ externalMessageId: string }> {
    const externalMessageId = `ex_sms_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 7)}`;
    return { externalMessageId };
  }

  async getDeliveryStatus(
    _clinicId: string,
    _externalMessageId: string
  ): Promise<{ status: string }> {
    return { status: 'delivered' };
  }

  async processOptOut(
    _clinicId: string,
    _recipientPhone: string
  ): Promise<boolean> {
    return true;
  }
}
