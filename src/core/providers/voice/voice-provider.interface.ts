import { CallEvent } from '../../types';

export interface OutboundCallRequest {
  clinicId: string;
  patientPhone: string;
  agentId?: string;
  greeting?: string;
  context?: Record<string, unknown>;
}

export interface VoicePlatformProvider {
  readonly providerName: 'sarvam' | 'xai' | 'elevenlabs';

  verifyWebhook(request: Request, bodyText: string): Promise<boolean>;
  normalizeWebhook(payload: Record<string, unknown>): Promise<CallEvent>;

  listAgents(clinicId: string): Promise<Array<{ id: string; name: string }>>;
  listPhoneNumbers(
    clinicId: string
  ): Promise<Array<{ id: string; phoneNumber: string }>>;

  startOutboundCall(
    req: OutboundCallRequest
  ): Promise<{ externalCallId: string }>;
  getCallStatus(clinicId: string, externalCallId: string): Promise<CallEvent>;
  getTranscript(
    clinicId: string,
    externalCallId: string
  ): Promise<string | null>;
  transferCall(
    clinicId: string,
    externalCallId: string,
    targetNumber: string
  ): Promise<boolean>;
  endCall(clinicId: string, externalCallId: string): Promise<boolean>;
}
