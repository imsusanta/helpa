export type VoiceProviderName = 'sarvam' | 'xai' | 'elevenlabs';

export type VoiceOperation =
  | 'inboundCalling'
  | 'outboundCalling'
  | 'callTransfer'
  | 'callTermination'
  | 'liveTranscription'
  | 'postCallTranscript'
  | 'signedWebhooks'
  | 'streamingAudio';

export type VoiceErrorCode =
  | 'VOICE_PROVIDER_NOT_CONFIGURED'
  | 'VOICE_OPERATION_UNSUPPORTED'
  | 'VOICE_AUTHENTICATION_FAILED'
  | 'VOICE_SIGNATURE_INVALID'
  | 'VOICE_REPLAY_DETECTED'
  | 'VOICE_PROVIDER_RATE_LIMITED'
  | 'VOICE_PROVIDER_TIMEOUT'
  | 'VOICE_PROVIDER_REQUEST_FAILED'
  | 'VOICE_TENANT_MAPPING_NOT_FOUND'
  | 'VOICE_DUPLICATE_EVENT';

export class VoiceProviderError extends Error {
  constructor(
    readonly code: VoiceErrorCode,
    message: string,
    readonly status = 502,
    readonly requestId?: string
  ) {
    super(message);
    this.name = 'VoiceProviderError';
  }
}

export interface VoiceCapabilities {
  inboundCalling: boolean;
  outboundCalling: boolean;
  callTransfer: boolean;
  callTermination: boolean;
  liveTranscription: boolean;
  postCallTranscript: boolean;
  signedWebhooks: boolean;
  streamingAudio: boolean;
}

export interface VoiceProviderConfig {
  apiKey?: string;
  agentId?: string;
  phoneNumberId?: string;
  webhookSecret?: string;
  baseUrl?: string;
}

export interface ProviderHealth {
  configured: boolean;
  credentialsValid: boolean;
  providerReachable: boolean;
  webhookConfigured: boolean;
  agentFound: boolean;
  phoneNumberFound: boolean;
  capabilities: VoiceCapabilities;
}

export interface WebhookVerification {
  verified: boolean;
  timestamp?: number;
}

export interface NormalizedVoiceWebhook {
  externalEventId: string;
  eventType: string;
  externalCallId: string;
  callId?: string;
  patientPhone?: string;
  humanHandoff?: boolean;
  externalAgentId?: string;
  externalPhoneNumberId?: string;
  direction?: 'inbound' | 'outbound';
  status?:
    | 'queued'
    | 'initiating'
    | 'ringing'
    | 'in_progress'
    | 'completed'
    | 'failed'
    | 'busy'
    | 'no_answer'
    | 'cancelled';
  startedAt?: string;
  answeredAt?: string;
  endedAt?: string;
  durationSeconds?: number;
  transcript?: string;
  summary?: string;
  failureCode?: string;
  failureMessageSanitized?: string;
}

export interface OutboundCallRequest {
  toNumber?: string;
  agentId?: string;
  phoneNumberId?: string;
  clinicId?: string;
  patientPhone?: string;
  recipientPhone?: string;
  greeting?: string;
  context?: Record<string, unknown>;
}

export interface ProviderCall {
  externalCallId: string;
  externalAgentId?: string;
  status: NormalizedVoiceWebhook['status'];
  direction?: 'inbound' | 'outbound';
  startedAt?: string;
  answeredAt?: string;
  endedAt?: string;
  durationSeconds?: number;
  transcript?: string;
  summary?: string;
  failureCode?: string;
  failureMessageSanitized?: string;
}

export interface VoiceProvider {
  readonly providerName: VoiceProviderName;
  readonly capabilities: VoiceCapabilities;
  validateConfiguration(): Promise<void>;
  verifyWebhook(rawBody: string, headers: Headers): Promise<WebhookVerification>;
  normalizeWebhook(rawBody: string, headers: Headers): Promise<NormalizedVoiceWebhook>;
  listAgents(): Promise<Array<{ id: string; name: string }>>;
  listPhoneNumbers(): Promise<Array<{ id: string; phoneNumberMasked: string }>>;
  initiateOutboundCall(request: OutboundCallRequest): Promise<{ externalCallId: string }>;
  startOutboundCall?(request: OutboundCallRequest): Promise<{ externalCallId: string }>;
  getCallStatus(externalCallId: string): Promise<ProviderCall>;
  getTranscript(externalCallId: string): Promise<string | null>;
  transferCall(externalCallId: string, targetNumber: string): Promise<void>;
  terminateCall(externalCallId: string): Promise<void>;
  healthCheck(): Promise<ProviderHealth>;
}

/** Compatibility alias for non-voice code that referenced the old name. */
export type VoicePlatformProvider = VoiceProvider;
