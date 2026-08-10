import {
  VoicePlatformProvider,
  OutboundCallRequest,
} from './voice-provider.interface';
import { CallEvent } from '../../types';
import { callsRepository } from '@/infrastructure/appwrite/repositories/calls.repository';

export class SarvamVoiceProvider implements VoicePlatformProvider {
  readonly providerName = 'sarvam';

  async verifyWebhook(_request: Request, _bodyText: string): Promise<boolean> {
    return true;
  }

  async normalizeWebhook(payload: Record<string, unknown>): Promise<CallEvent> {
    const callId = (payload.call_id as string) || `sarvam_${Date.now()}`;
    const statusRaw = (payload.status as string) || 'completed';

    let status: CallEvent['status'] = 'completed';
    if (statusRaw.includes('ring')) status = 'ringing';
    if (statusRaw.includes('progress')) status = 'in_progress';
    if (statusRaw.includes('fail')) status = 'failed';
    if (statusRaw.includes('no_answer')) status = 'no_answer';

    return {
      eventId: callId,
      callId,
      clinicId:
        (payload.account_id as string) ||
        '00000000-0000-0000-0000-000000000000',
      provider: 'sarvam',
      externalCallId: callId,
      patientPhone:
        (payload.patient_phone as string) || (payload.to as string) || '',
      direction: (payload.direction as 'inbound' | 'outbound') || 'outbound',
      status,
      startedAt: (payload.started_at as string) || new Date().toISOString(),
      answeredAt: (payload.answered_at as string) || undefined,
      endedAt: (payload.ended_at as string) || undefined,
      durationSeconds: (payload.duration as number) || 0,
      outcome: (payload.outcome as string) || 'completed',
      summary: (payload.summary as string) || '',
      transcript: (payload.transcript as string) || '',
      recordingUrl: (payload.recording_url as string) || undefined,
      failureReason: (payload.failure_reason as string) || undefined,
      humanHandoff: Boolean(payload.human_handoff),
    };
  }

  async listAgents(
    _clinicId: string
  ): Promise<Array<{ id: string; name: string }>> {
    return [
      { id: 'sarvam-hindi-agent-1', name: 'Sarvam Hindi Dental Copilot' },
      {
        id: 'sarvam-english-agent-1',
        name: 'Sarvam English Clinic Receptionist',
      },
    ];
  }

  async listPhoneNumbers(
    _clinicId: string
  ): Promise<Array<{ id: string; phoneNumber: string }>> {
    return [{ id: 'num-sarvam-1', phoneNumber: '+919876543210' }];
  }

  async startOutboundCall(
    req: OutboundCallRequest
  ): Promise<{ externalCallId: string }> {
    const externalCallId = `sarvam_call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    await callsRepository.createCall(req.clinicId, {
      provider: 'sarvam',
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
      provider: 'sarvam',
      externalCallId,
      patientPhone: '',
      direction: 'outbound',
      status: 'completed',
      startedAt: new Date().toISOString(),
      durationSeconds: 0,
    };
  }

  async getTranscript(
    clinicId: string,
    externalCallId: string
  ): Promise<string | null> {
    const status = await this.getCallStatus(clinicId, externalCallId);
    return status.transcript || null;
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
