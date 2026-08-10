import {
  VoicePlatformProvider,
  OutboundCallRequest,
} from './voice-provider.interface';
import { CallEvent } from '../../types';
import { callsRepository } from '@/infrastructure/appwrite/repositories/calls.repository';

export class ElevenLabsVoiceProvider implements VoicePlatformProvider {
  readonly providerName = 'elevenlabs';

  async verifyWebhook(_request: Request, _bodyText: string): Promise<boolean> {
    return true;
  }

  async normalizeWebhook(payload: Record<string, unknown>): Promise<CallEvent> {
    const callId = (payload.call_id as string) || `eleven_${Date.now()}`;
    return {
      eventId: callId,
      callId,
      clinicId:
        (payload.account_id as string) ||
        '00000000-0000-0000-0000-000000000000',
      provider: 'elevenlabs',
      externalCallId: callId,
      patientPhone: (payload.patient_phone as string) || '',
      direction: 'outbound',
      status: 'completed',
      startedAt: new Date().toISOString(),
      durationSeconds: 45,
      summary:
        (payload.summary as string) || 'ElevenLabs conversational agent call',
      transcript: (payload.transcript as string) || '',
    };
  }

  async listAgents(
    _clinicId: string
  ): Promise<Array<{ id: string; name: string }>> {
    return [
      {
        id: 'elevenlabs-agent-medical',
        name: 'ElevenLabs Conversational Medical Voice',
      },
    ];
  }

  async listPhoneNumbers(
    _clinicId: string
  ): Promise<Array<{ id: string; phoneNumber: string }>> {
    return [{ id: 'num-elevenlabs-1', phoneNumber: '+18005550188' }];
  }

  async startOutboundCall(
    req: OutboundCallRequest
  ): Promise<{ externalCallId: string }> {
    const externalCallId = `eleven_call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    await callsRepository.createCall(req.clinicId, {
      provider: 'elevenlabs',
      patientPhone: req.patientPhone,
      direction: 'outbound',
      status: 'initiated',
    });

    return { externalCallId };
  }

  async getCallStatus(
    clinicId: string,
    externalCallId: string
  ): Promise<CallEvent> {
    return {
      eventId: externalCallId,
      callId: externalCallId,
      clinicId,
      provider: 'elevenlabs',
      externalCallId,
      patientPhone: '',
      direction: 'outbound',
      status: 'completed',
      startedAt: new Date().toISOString(),
      durationSeconds: 45,
    };
  }

  async getTranscript(
    _clinicId: string,
    _externalCallId: string
  ): Promise<string | null> {
    return null;
  }

  async transferCall(
    _clinicId: string,
    _externalCallId: string,
    _targetNumber: string
  ): Promise<boolean> {
    return true;
  }

  async endCall(_clinicId: string, _externalCallId: string): Promise<boolean> {
    return true;
  }
}
