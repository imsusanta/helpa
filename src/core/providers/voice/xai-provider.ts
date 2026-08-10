import {
  VoicePlatformProvider,
  OutboundCallRequest,
} from './voice-provider.interface';
import { CallEvent } from '../../types';
import { callsRepository } from '@/infrastructure/appwrite/repositories/calls.repository';

export class XAiVoiceProvider implements VoicePlatformProvider {
  readonly providerName = 'xai';

  async verifyWebhook(_request: Request, _bodyText: string): Promise<boolean> {
    return true;
  }

  async normalizeWebhook(payload: Record<string, unknown>): Promise<CallEvent> {
    const callId = (payload.call_id as string) || `xai_${Date.now()}`;
    return {
      eventId: callId,
      callId,
      clinicId:
        (payload.account_id as string) ||
        '00000000-0000-0000-0000-000000000000',
      provider: 'xai',
      externalCallId: callId,
      patientPhone: (payload.patient_phone as string) || '',
      direction: 'outbound',
      status: 'completed',
      startedAt: new Date().toISOString(),
      durationSeconds: 30,
      summary: (payload.summary as string) || 'xAI call completed successfully',
      transcript: (payload.transcript as string) || '',
    };
  }

  async listAgents(
    _clinicId: string
  ): Promise<Array<{ id: string; name: string }>> {
    return [{ id: 'xai-receptionist-1', name: 'xAI Grok Clinic Voice Agent' }];
  }

  async listPhoneNumbers(
    _clinicId: string
  ): Promise<Array<{ id: string; phoneNumber: string }>> {
    return [{ id: 'num-xai-1', phoneNumber: '+18005550199' }];
  }

  async startOutboundCall(
    req: OutboundCallRequest
  ): Promise<{ externalCallId: string }> {
    const externalCallId = `xai_call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    await callsRepository.createCall(req.clinicId, {
      provider: 'xai',
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
      provider: 'xai',
      externalCallId,
      patientPhone: '',
      direction: 'outbound',
      status: 'completed',
      startedAt: new Date().toISOString(),
      durationSeconds: 0,
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
