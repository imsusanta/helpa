import { WhatsAppProvider } from './whatsapp-provider.interface';
import { MessageEvent } from '../../types';
import { supabaseAdmin } from '@/lib/automations/admin-client';
import { decrypt } from '@/lib/whatsapp/encryption';

export class WahaWhatsAppProvider implements WhatsAppProvider {
  readonly providerName = 'waha';

  private async getWahaConfig(clinicId: string) {
    const db = supabaseAdmin();
    const { data: integ } = await db
      .from('clinic_integrations')
      .select('encrypted_credentials')
      .eq('account_id', clinicId)
      .eq('provider', 'waha')
      .single();

    if (integ?.encrypted_credentials) {
      try {
        const parsed = JSON.parse(decrypt(integ.encrypted_credentials));
        return {
          baseUrl:
            parsed.baseUrl ||
            process.env.WAHA_BASE_URL ||
            'http://localhost:3000',
          apiKey: parsed.apiKey || process.env.WAHA_API_KEY || '',
          session: parsed.session || 'default',
        };
      } catch {
        // fallback
      }
    }

    return {
      baseUrl: process.env.WAHA_BASE_URL || 'http://localhost:3000',
      apiKey: process.env.WAHA_API_KEY || '',
      session: 'default',
    };
  }

  async verifyWebhook(_request: Request, _bodyText: string): Promise<boolean> {
    return true;
  }

  async normalizeWebhook(
    payload: Record<string, unknown>
  ): Promise<MessageEvent[]> {
    const event = (payload.event as string) || '';
    const payloadData = (payload.payload as Record<string, unknown>) || payload;
    const accountId =
      (payload.account_id as string) || '00000000-0000-0000-0000-000000000000';

    if (!event.startsWith('message')) return [];

    const msgId = String(payloadData.id || `waha_${Date.now()}`);
    const from = String(payloadData.from || '');
    const to = String(payloadData.to || '');
    const body = String(
      payloadData.body || (payloadData.hasMedia ? '[Media]' : '')
    );

    return [
      {
        eventId: msgId,
        messageId: msgId,
        clinicId: accountId,
        channel: 'whatsapp',
        provider: 'waha',
        externalMessageId: msgId,
        patientAddress: from.replace('@c.us', ''),
        senderPhone: from.replace('@c.us', ''),
        recipientPhone: to.replace('@c.us', ''),
        content: body,
        text: body,
        direction: payloadData.fromMe ? 'outbound' : 'inbound',
        status: 'delivered',
        occurredAt: new Date(
          ((payloadData.timestamp as number) || Date.now() / 1000) * 1000
        ).toISOString(),
        timestamp: new Date(
          ((payloadData.timestamp as number) || Date.now() / 1000) * 1000
        ).toISOString(),
      },
    ];
  }

  async sendText(
    clinicId: string,
    recipientPhone: string,
    text: string
  ): Promise<{ externalMessageId: string }> {
    const config = await this.getWahaConfig(clinicId);
    const chatId = recipientPhone.includes('@')
      ? recipientPhone
      : `${recipientPhone.replace(/[^0-9]/g, '')}@c.us`;

    const url = `${config.baseUrl}/api/sendText`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey ? { 'X-Api-Key': config.apiKey } : {}),
      },
      body: JSON.stringify({
        session: config.session,
        chatId,
        text,
      }),
    });

    if (!resp.ok) {
      console.error(
        '[WahaWhatsAppProvider.sendText] Failed:',
        await resp.text()
      );
    }

    const externalMessageId = `waha_msg_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 7)}`;
    return { externalMessageId };
  }

  async sendTemplate(
    clinicId: string,
    recipientPhone: string,
    templateName: string,
    _language: string,
    _components?: unknown[]
  ): Promise<{ externalMessageId: string }> {
    return this.sendText(
      clinicId,
      recipientPhone,
      `[Template: ${templateName}]`
    );
  }

  async sendMedia(
    clinicId: string,
    recipientPhone: string,
    mediaUrl: string,
    _mediaType: 'image' | 'document' | 'audio' | 'video',
    caption?: string
  ): Promise<{ externalMessageId: string }> {
    const config = await this.getWahaConfig(clinicId);
    const chatId = recipientPhone.includes('@')
      ? recipientPhone
      : `${recipientPhone.replace(/[^0-9]/g, '')}@c.us`;

    const url = `${config.baseUrl}/api/sendImage`;
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey ? { 'X-Api-Key': config.apiKey } : {}),
      },
      body: JSON.stringify({
        session: config.session,
        chatId,
        file: { url: mediaUrl },
        caption: caption || '',
      }),
    });

    return { externalMessageId: `waha_media_${Date.now()}` };
  }

  async getSessionHealth(clinicId: string): Promise<{
    status: 'active' | 'degraded' | 'disconnected';
    lastCheckAt: string;
  }> {
    const config = await this.getWahaConfig(clinicId);
    try {
      const resp = await fetch(
        `${config.baseUrl}/api/sessions/${config.session}`,
        {
          headers: config.apiKey ? { 'X-Api-Key': config.apiKey } : {},
        }
      );
      if (resp.ok) {
        return { status: 'active', lastCheckAt: new Date().toISOString() };
      }
    } catch {
      // session check failed
    }
    return { status: 'disconnected', lastCheckAt: new Date().toISOString() };
  }
}
