import crypto from 'node:crypto';
import {
  OutboundCallRequest,
  NormalizedVoiceWebhook,
  ProviderCall,
  ProviderHealth,
  VoiceCapabilities,
  VoiceOperation,
  VoiceProvider,
  VoiceProviderConfig,
  VoiceProviderError,
  WebhookVerification,
} from './voice-provider.interface';

const DEFAULT_BASE_URL = 'https://api.elevenlabs.io/v1';
const REQUEST_TIMEOUT_MS = 10_000;
const WEBHOOK_TOLERANCE_SECONDS = 300;

const capabilities: VoiceCapabilities = {
  inboundCalling: true,
  outboundCalling: true,
  callTransfer: false,
  callTermination: false,
  liveTranscription: false,
  postCallTranscript: true,
  signedWebhooks: true,
  streamingAudio: false,
};

type JsonRecord = Record<string, unknown>;

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function objectValue(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function redactPhone(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value.length < 4
    ? '***'
    : `${'*'.repeat(Math.max(0, value.length - 4))}${value.slice(-4)}`;
}

function mapProviderStatus(
  status: string | undefined
): NormalizedVoiceWebhook['status'] {
  switch (status) {
    case 'initiated':
      return 'initiating';
    case 'in-progress':
      return 'in_progress';
    case 'done':
      return 'completed';
    case 'failed':
      return 'failed';
    case 'processing':
      return 'in_progress';
    default:
      return undefined;
  }
}

export class ElevenLabsVoiceProvider implements VoiceProvider {
  readonly providerName = 'elevenlabs' as const;
  readonly capabilities = capabilities;
  private readonly config: VoiceProviderConfig;

  constructor(
    config: VoiceProviderConfig = {
      apiKey: process.env.ELEVENLABS_API_KEY,
      agentId: process.env.ELEVENLABS_AGENT_ID,
      phoneNumberId: process.env.ELEVENLABS_PHONE_NUMBER_ID,
      webhookSecret: process.env.ELEVENLABS_WEBHOOK_SECRET,
      baseUrl: process.env.ELEVENLABS_BASE_URL,
    }
  ) {
    this.config = config;
  }

  async validateConfiguration(): Promise<void> {
    if (!this.config.apiKey)
      throw new VoiceProviderError(
        'VOICE_PROVIDER_NOT_CONFIGURED',
        'ElevenLabs API key is not configured',
        503
      );
    if (!this.config.webhookSecret)
      throw new VoiceProviderError(
        'VOICE_PROVIDER_NOT_CONFIGURED',
        'ElevenLabs webhook secret is not configured',
        503
      );
  }

  async verifyWebhook(
    rawBody: string,
    headers: Headers
  ): Promise<WebhookVerification> {
    const signature = headers.get('elevenlabs-signature');
    const secret = this.config.webhookSecret;
    if (!signature || !secret)
      throw new VoiceProviderError(
        'VOICE_SIGNATURE_INVALID',
        'Missing ElevenLabs webhook signature',
        401
      );
    const parts = new Map(
      signature.split(',').map((part) => {
        const [key, value] = part.split('=', 2);
        return [key, value] as const;
      })
    );
    const timestamp = Number(parts.get('t'));
    const received = parts.get('v0');
    if (!Number.isSafeInteger(timestamp) || !received)
      throw new VoiceProviderError(
        'VOICE_SIGNATURE_INVALID',
        'Malformed ElevenLabs webhook signature',
        401
      );
    if (
      Math.abs(Math.floor(Date.now() / 1000) - timestamp) >
      WEBHOOK_TOLERANCE_SECONDS
    ) {
      throw new VoiceProviderError(
        'VOICE_REPLAY_DETECTED',
        'ElevenLabs webhook is outside the replay window',
        401
      );
    }
    const expected = crypto
      .createHmac('sha256', secret)
      .update(`${timestamp}.${rawBody}`)
      .digest('hex');
    const expectedBuffer = Buffer.from(expected, 'utf8');
    const receivedBuffer = Buffer.from(received, 'utf8');
    if (
      expectedBuffer.length !== receivedBuffer.length ||
      !crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
    ) {
      throw new VoiceProviderError(
        'VOICE_SIGNATURE_INVALID',
        'Invalid ElevenLabs webhook signature',
        401
      );
    }
    return { verified: true, timestamp };
  }

  async normalizeWebhook(rawBody: string): Promise<NormalizedVoiceWebhook> {
    let payload: JsonRecord;
    try {
      payload = JSON.parse(rawBody) as JsonRecord;
    } catch {
      throw new VoiceProviderError(
        'VOICE_PROVIDER_REQUEST_FAILED',
        'Invalid webhook JSON',
        400
      );
    }
    const data = objectValue(payload.data);
    const type = stringValue(payload.type);
    const conversationId = stringValue(data.conversation_id);
    const agentId = stringValue(data.agent_id);
    if (!type || !conversationId || !agentId)
      throw new VoiceProviderError(
        'VOICE_PROVIDER_REQUEST_FAILED',
        'ElevenLabs webhook is missing its documented event identifiers',
        400
      );
    const metadata = objectValue(data.metadata);
    const analysis = objectValue(data.analysis);
    const transcript = Array.isArray(data.transcript)
      ? data.transcript
          .map((turn) => objectValue(turn).message)
          .filter((message): message is string => typeof message === 'string')
          .join('\n')
      : undefined;
    const failureReason = stringValue(data.failure_reason);
    const status =
      type === 'call_initiation_failure'
        ? failureReason === 'busy'
          ? 'busy'
          : failureReason === 'no-answer'
            ? 'no_answer'
            : 'failed'
        : mapProviderStatus(stringValue(data.status));
    const startSeconds = Number(metadata.start_time_unix_secs);
    const duration = Number(metadata.call_duration_secs);
    return {
      externalEventId: `${type}:${conversationId}`,
      eventType: type,
      externalCallId: conversationId,
      externalAgentId: agentId,
      direction: 'outbound',
      status,
      startedAt: Number.isFinite(startSeconds)
        ? new Date(startSeconds * 1000).toISOString()
        : undefined,
      endedAt:
        status === 'completed' ||
        status === 'failed' ||
        status === 'busy' ||
        status === 'no_answer'
          ? new Date().toISOString()
          : undefined,
      durationSeconds: Number.isFinite(duration) ? duration : undefined,
      transcript,
      summary: stringValue(analysis.transcript_summary),
      failureCode: failureReason,
      failureMessageSanitized: failureReason
        ? failureReason.slice(0, 120)
        : undefined,
    };
  }

  async listAgents(): Promise<Array<{ id: string; name: string }>> {
    const body = await this.request<JsonRecord>('/convai/agents?page_size=100');
    const agents = Array.isArray(body.agents) ? body.agents : [];
    return agents
      .map((agent) => {
        const item = objectValue(agent);
        return {
          id: stringValue(item.agent_id) || '',
          name: stringValue(item.name) || '',
        };
      })
      .filter((agent) => agent.id && agent.name);
  }

  async listPhoneNumbers(): Promise<
    Array<{ id: string; phoneNumberMasked: string }>
  > {
    const body = await this.request<unknown>('/convai/phone-numbers');
    const numbers = Array.isArray(body) ? body : [];
    return numbers
      .map((number) => {
        const item = objectValue(number);
        return {
          id: stringValue(item.phone_number_id) || '',
          phoneNumberMasked: redactPhone(stringValue(item.phone_number)) || '',
        };
      })
      .filter((number) => number.id);
  }

  async validateOutboundConfig(): Promise<void> {
    await this.validateConfiguration();
    if (!this.config.agentId)
      throw new VoiceProviderError(
        'VOICE_PROVIDER_NOT_CONFIGURED',
        'ElevenLabs agent ID is not configured',
        503
      );
    if (!this.config.phoneNumberId)
      throw new VoiceProviderError(
        'VOICE_PROVIDER_NOT_CONFIGURED',
        'ElevenLabs phone number ID is not configured',
        503
      );
  }

  async initiateOutboundCall(
    request: OutboundCallRequest
  ): Promise<{ externalCallId: string }> {
    await this.validateOutboundConfig();
    const body = await this.request<JsonRecord>(
      '/convai/sip-trunk/outbound-call',
      {
        method: 'POST',
        body: JSON.stringify({
          agent_id: request.agentId || this.config.agentId,
          agent_phone_number_id:
            request.phoneNumberId || this.config.phoneNumberId,
          to_number: request.toNumber,
          ...(request.context
            ? { conversation_initiation_client_data: request.context }
            : {}),
        }),
      }
    );
    const conversationId = stringValue(body.conversation_id);
    if (body.success !== true || !conversationId)
      throw new VoiceProviderError(
        'VOICE_PROVIDER_REQUEST_FAILED',
        'ElevenLabs did not confirm outbound call initiation',
        502
      );
    return { externalCallId: conversationId };
  }

  async startOutboundCall(
    request: OutboundCallRequest
  ): Promise<{ externalCallId: string }> {
    return this.initiateOutboundCall(request);
  }

  async getCallStatus(externalCallId: string): Promise<ProviderCall> {
    const body = await this.request<JsonRecord>(
      `/convai/conversations/${encodeURIComponent(externalCallId)}`
    );
    return {
      externalCallId,
      externalAgentId: stringValue(body.agent_id),
      status: mapProviderStatus(stringValue(body.status)),
      direction: 'outbound',
      transcript: this.transcriptFrom(body.transcript),
      durationSeconds:
        Number(objectValue(body.metadata).call_duration_secs) || undefined,
    };
  }

  async getTranscript(externalCallId: string): Promise<string | null> {
    return (await this.getCallStatus(externalCallId)).transcript || null;
  }

  async transferCall(): Promise<void> {
    this.unsupported('callTransfer');
  }
  async terminateCall(): Promise<void> {
    this.unsupported('callTermination');
  }

  async healthCheck(): Promise<ProviderHealth> {
    const base: ProviderHealth = {
      configured: Boolean(this.config.apiKey),
      credentialsValid: false,
      providerReachable: false,
      webhookConfigured: Boolean(this.config.webhookSecret),
      agentFound: false,
      phoneNumberFound: false,
      capabilities,
    };
    if (!this.config.apiKey) return base;
    try {
      const [agents, numbers] = await Promise.all([
        this.listAgents(),
        this.listPhoneNumbers(),
      ]);
      base.credentialsValid = true;
      base.providerReachable = true;
      base.agentFound =
        !this.config.agentId ||
        agents.some((agent) => agent.id === this.config.agentId);
      base.phoneNumberFound =
        !this.config.phoneNumberId ||
        numbers.some((number) => number.id === this.config.phoneNumberId);
    } catch {
      /* health is deliberately safe and non-sensitive */
    }
    return base;
  }

  private transcriptFrom(value: unknown): string | undefined {
    if (!Array.isArray(value)) return undefined;
    return (
      value
        .map((turn) => objectValue(turn).message)
        .filter((message): message is string => typeof message === 'string')
        .join('\n') || undefined
    );
  }

  private unsupported(operation: VoiceOperation): never {
    throw new VoiceProviderError(
      'VOICE_OPERATION_UNSUPPORTED',
      `ElevenLabs does not expose ${operation} through the documented API`,
      501
    );
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    if (!this.config.apiKey)
      throw new VoiceProviderError(
        'VOICE_PROVIDER_NOT_CONFIGURED',
        'ElevenLabs API key is not configured',
        503
      );
    const requestId = crypto.randomUUID();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(
        `${this.config.baseUrl || DEFAULT_BASE_URL}${path}`,
        {
          ...init,
          signal: controller.signal,
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'xi-api-key': this.config.apiKey,
            'X-Request-ID': requestId,
            ...(init.headers || {}),
          },
        }
      );
      const text = await response.text();
      let body: unknown;
      try {
        body = text ? JSON.parse(text) : undefined;
      } catch {
        body = undefined;
      }
      if (!response.ok) {
        const code =
          response.status === 401 || response.status === 403
            ? 'VOICE_AUTHENTICATION_FAILED'
            : response.status === 429
              ? 'VOICE_PROVIDER_RATE_LIMITED'
              : 'VOICE_PROVIDER_REQUEST_FAILED';
        throw new VoiceProviderError(
          code,
          `ElevenLabs request failed (${response.status})`,
          response.status,
          requestId
        );
      }
      return body as T;
    } catch (error) {
      if (error instanceof VoiceProviderError) throw error;
      if (error instanceof DOMException && error.name === 'AbortError')
        throw new VoiceProviderError(
          'VOICE_PROVIDER_TIMEOUT',
          'ElevenLabs request timed out',
          504,
          requestId
        );
      throw new VoiceProviderError(
        'VOICE_PROVIDER_REQUEST_FAILED',
        'ElevenLabs request failed',
        502,
        requestId
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
