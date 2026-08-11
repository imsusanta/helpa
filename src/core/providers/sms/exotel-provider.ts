import { SmsProvider } from './sms-provider.interface';
import { MessageEvent } from '../../types';

export class ExotelSmsProvider implements SmsProvider {
  readonly providerName = 'exotel';

  async verifyWebhook(_request: Request, _bodyText: string): Promise<boolean> {
    return false;
  }

  async normalizeWebhook(
    _payload: Record<string, unknown>
  ): Promise<MessageEvent> {
    throw Object.assign(
      new Error('Exotel SMS integration is disabled / unconfigured.'),
      { code: 'SMS_OPERATION_UNSUPPORTED', status: 501 }
    );
  }

  async sendText(
    _clinicId: string,
    _recipientPhone: string,
    _text: string
  ): Promise<{ externalMessageId: string }> {
    throw Object.assign(
      new Error('Exotel SMS integration is disabled / unconfigured.'),
      { code: 'SMS_OPERATION_UNSUPPORTED', status: 501 }
    );
  }

  async getDeliveryStatus(
    _clinicId: string,
    _externalMessageId: string
  ): Promise<{ status: string }> {
    throw Object.assign(
      new Error('Exotel SMS integration is disabled / unconfigured.'),
      { code: 'SMS_OPERATION_UNSUPPORTED', status: 501 }
    );
  }

  async processOptOut(
    _clinicId: string,
    _recipientPhone: string
  ): Promise<boolean> {
    throw Object.assign(
      new Error('Exotel SMS integration is disabled / unconfigured.'),
      { code: 'SMS_OPERATION_UNSUPPORTED', status: 501 }
    );
  }
}
