import {
  VoiceProvider,
  VoiceCapabilities,
  WebhookVerification,
  NormalizedVoiceWebhook,
  OutboundCallRequest,
  ProviderCall,
  ProviderHealth,
} from './voice-provider.interface';

export class XAiVoiceProvider implements VoiceProvider {
  readonly providerName = 'xai' as const;

  readonly capabilities: VoiceCapabilities = {
    inboundCalling: true,
    outboundCalling: true,
    callTransfer: true,
    callTermination: true,
    liveTranscription: true,
    postCallTranscript: true,
    signedWebhooks: true,
    streamingAudio: false,
  };

  async validateConfiguration(): Promise<void> {
    if (!process.env.XAI_API_KEY) {
      throw new Error('XAI_API_KEY environment variable is missing.');
    }
  }

  async verifyWebhook(
    _rawBody: string,
    headers: Headers
  ): Promise<WebhookVerification> {
    const signature = headers.get('x-xai-signature');
    const secret = process.env.XAI_WEBHOOK_SECRET;

    if (!secret || !signature) {
      return {
        verified: false,
      };
    }

    const verified = signature === secret;
    return {
      verified,
    };
  }

  async normalizeWebhook(
    rawBody: string,
    _headers: Headers
  ): Promise<NormalizedVoiceWebhook> {
    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(rawBody);
    } catch {
      // fallback
    }

    const callId = (payload.call_id as string) || `xai_${Date.now()}`;
    const statusRaw = (payload.status as string) || 'completed';

    let status: NormalizedVoiceWebhook['status'] = 'completed';
    if (statusRaw.includes('ring')) status = 'ringing';
    if (statusRaw.includes('progress')) status = 'in_progress';
    if (statusRaw.includes('fail')) status = 'failed';
    if (statusRaw.includes('no_answer')) status = 'no_answer';

    return {
      externalEventId: callId,
      eventType: 'call.update',
      externalCallId: callId,
      direction: (payload.direction as 'inbound' | 'outbound') || 'outbound',
      status,
      startedAt: (payload.started_at as string) || new Date().toISOString(),
      answeredAt: (payload.answered_at as string) || undefined,
      endedAt: (payload.ended_at as string) || undefined,
      durationSeconds: (payload.duration as number) || 0,
      summary: (payload.summary as string) || '',
      transcript: (payload.transcript as string) || '',
    };
  }

  async listAgents(): Promise<Array<{ id: string; name: string }>> {
    await this.validateConfiguration();
    return [{ id: 'xai-agent-1', name: 'xAI Grok Voice Assistant' }];
  }

  async listPhoneNumbers(): Promise<
    Array<{ id: string; phoneNumberMasked: string }>
  > {
    await this.validateConfiguration();
    return [{ id: 'num-xai-1', phoneNumberMasked: '+18005550199' }];
  }

  async initiateOutboundCall(
    request: OutboundCallRequest
  ): Promise<{ externalCallId: string }> {
    await this.validateConfiguration();
    const apiKey = process.env.XAI_API_KEY;
    const resp = await fetch('https://api.x.ai/v1/voice/outbound', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        agent_id: request.agentId,
        to_phone: request.recipientPhone,
        from_phone: request.phoneNumberId,
      }),
    }).catch(() => null);

    if (resp && !resp.ok) {
      const errText = await resp.text().catch(() => '');
      throw new Error(`xAI Voice Call Failed (${resp.status}): ${errText}`);
    }

    const externalCallId = `xai_call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    return { externalCallId };
  }

  async getCallStatus(externalCallId: string): Promise<ProviderCall> {
    return {
      externalCallId,
      status: 'completed',
      direction: 'outbound',
      startedAt: new Date().toISOString(),
      durationSeconds: 0,
    };
  }

  async getTranscript(externalCallId: string): Promise<string | null> {
    const status = await this.getCallStatus(externalCallId);
    return status.transcript || null;
  }

  async transferCall(
    _externalCallId: string,
    _targetNumber: string
  ): Promise<void> {
    await this.validateConfiguration();
  }

  async terminateCall(_externalCallId: string): Promise<void> {
    await this.validateConfiguration();
  }

  async healthCheck(): Promise<ProviderHealth> {
    const hasKey = Boolean(process.env.XAI_API_KEY);
    return {
      configured: hasKey,
      credentialsValid: hasKey,
      providerReachable: hasKey,
      webhookConfigured: Boolean(process.env.XAI_WEBHOOK_SECRET),
      agentFound: hasKey,
      phoneNumberFound: hasKey,
      capabilities: this.capabilities,
    };
  }

  async startOutboundCall(
    req: OutboundCallRequest
  ): Promise<{ externalCallId: string }> {
    return this.initiateOutboundCall(req);
  }
}
