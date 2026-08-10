import {
  VoicePlatformProvider,
  OutboundCallRequest,
} from './voice-provider.interface';
import { CallEvent } from '../../types';
import { supabaseAdmin } from '@/lib/automations/admin-client';
import { decrypt } from '@/lib/whatsapp/encryption';

export class SarvamVoiceProvider implements VoicePlatformProvider {
  readonly providerName = 'sarvam';

  private async getApiKey(clinicId: string): Promise<string> {
    const db = supabaseAdmin();
    const { data: integ } = await db
      .from('clinic_integrations')
      .select('encrypted_credentials')
      .eq('account_id', clinicId)
      .eq('provider', 'sarvam')
      .single();

    if (integ?.encrypted_credentials) {
      try {
        const parsed = JSON.parse(decrypt(integ.encrypted_credentials));
        return parsed.apiKey || process.env.SARVAM_API_KEY || '';
      } catch {
        // fallback
      }
    }
    return process.env.SARVAM_API_KEY || 'mock_sarvam_key';
  }

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
    const _apiKey = await this.getApiKey(req.clinicId);
    const externalCallId = `sarvam_call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const db = supabaseAdmin();
    await db.from('calls').insert({
      account_id: req.clinicId,
      provider: 'sarvam',
      external_call_id: externalCallId,
      direction: 'outbound',
      status: 'initiated',
      patient_phone: req.patientPhone,
      started_at: new Date().toISOString(),
    });

    return { externalCallId };
  }

  async getCallStatus(
    clinicId: string,
    externalCallId: string
  ): Promise<CallEvent> {
    const db = supabaseAdmin();
    const { data: call } = await db
      .from('calls')
      .select('*')
      .eq('account_id', clinicId)
      .eq('external_call_id', externalCallId)
      .single();

    if (!call) {
      return {
        eventId: externalCallId,
        callId: externalCallId,
        clinicId,
        provider: 'sarvam',
        externalCallId,
        patientPhone: '',
        direction: 'outbound',
        status: 'initiated',
        startedAt: new Date().toISOString(),
        durationSeconds: 0,
      };
    }

    return {
      eventId: call.id,
      callId: call.id,
      clinicId,
      provider: 'sarvam',
      externalCallId: call.external_call_id,
      patientPhone: call.patient_phone,
      direction: call.direction,
      status: call.status,
      startedAt: call.started_at,
      answeredAt: call.answered_at,
      endedAt: call.ended_at,
      durationSeconds: call.duration_seconds || 0,
      summary: call.summary,
      transcript: call.transcript,
      humanHandoff: call.human_handoff,
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
    clinicId: string,
    externalCallId: string,
    _targetNumber: string
  ): Promise<boolean> {
    const db = supabaseAdmin();
    await db
      .from('calls')
      .update({ status: 'transferred', human_handoff: true })
      .eq('account_id', clinicId)
      .eq('external_call_id', externalCallId);
    return true;
  }

  async endCall(clinicId: string, externalCallId: string): Promise<boolean> {
    const db = supabaseAdmin();
    await db
      .from('calls')
      .update({ status: 'completed', ended_at: new Date().toISOString() })
      .eq('account_id', clinicId)
      .eq('external_call_id', externalCallId);
    return true;
  }
}
