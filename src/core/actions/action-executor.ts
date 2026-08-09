import { supabaseAdmin } from '@/lib/automations/admin-client';
import { LeadStageType } from '../types';

export interface ActionContext {
  accountId: string;
  actorId: string;
  actorType: 'system' | 'ai' | 'user' | 'webhook';
  idempotencyKey?: string;
}

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  auditLogId?: string;
}

export class TrustedActionExecutor {
  private context: ActionContext;

  constructor(context: ActionContext) {
    if (!context.accountId) {
      throw new Error(
        'TrustedActionExecutor requires a trusted accountId context.'
      );
    }
    this.context = context;
  }

  // 1. Transition Lead Stage with History Audit
  async transitionLead(params: {
    leadId: string;
    nextStage: LeadStageType;
    reason?: string;
  }): Promise<ActionResult> {
    const db = supabaseAdmin();
    try {
      // Get current stage
      const { data: lead, error: fetchErr } = await db
        .from('deals')
        .select('id, stage, account_id')
        .eq('id', params.leadId)
        .eq('account_id', this.context.accountId)
        .single();

      if (fetchErr || !lead) {
        return { success: false, error: 'Lead not found in clinic tenant.' };
      }

      const previousStage = (lead.stage || 'NEW') as LeadStageType;

      // Update stage
      const { error: updateErr } = await db
        .from('deals')
        .update({
          stage: params.nextStage,
          updated_at: new Date().toISOString(),
        })
        .eq('id', params.leadId)
        .eq('account_id', this.context.accountId);

      if (updateErr) throw updateErr;

      // Record stage transition history
      await db.from('lead_stage_history').insert({
        account_id: this.context.accountId,
        lead_id: params.leadId,
        previous_stage: previousStage,
        next_stage: params.nextStage,
        reason: params.reason || null,
        source: 'action_executor',
        actor_type: this.context.actorType,
        actor_id: this.context.actorId || null,
      });

      return {
        success: true,
        data: {
          leadId: params.leadId,
          previousStage,
          nextStage: params.nextStage,
        },
      };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message || String(err) };
    }
  }

  // 2. Book Calendly Event & Create Appointment
  async bookCalendlyEvent(params: {
    patientName: string;
    patientPhone: string;
    patientEmail?: string;
    startAt: string;
    serviceName?: string;
    doctorId?: string;
  }): Promise<ActionResult> {
    const db = supabaseAdmin();
    try {
      // Create appointment in database
      const { data: appt, error } = await db
        .from('appointments')
        .insert({
          account_id: this.context.accountId,
          patient_name: params.patientName,
          patient_phone: params.patientPhone,
          appointment_date: params.startAt.split('T')[0],
          appointment_time:
            params.startAt.split('T')[1]?.slice(0, 5) || '10:00',
          status: 'Confirmed',
          booking_source: 'calendly_ai',
        })
        .select('id')
        .single();

      if (error) throw error;

      // Log audit
      await db.from('audit_logs').insert({
        account_id: this.context.accountId,
        actor_id: this.context.actorId,
        action: 'calendly.booking_created',
        resource_type: 'appointments',
        resource_id: appt.id,
        metadata: { startAt: params.startAt, patientName: params.patientName },
      });

      return {
        success: true,
        data: { appointmentId: appt.id, status: 'Confirmed' },
      };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message || String(err) };
    }
  }

  // 3. Human Handoff (Pause AI for Contact/Conversation)
  async handoffToHuman(params: {
    conversationId: string;
    reason: string;
  }): Promise<ActionResult> {
    const db = supabaseAdmin();
    try {
      const { error } = await db
        .from('conversations')
        .update({
          ai_enabled: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', params.conversationId)
        .eq('account_id', this.context.accountId);

      if (error) throw error;

      return {
        success: true,
        data: { conversationId: params.conversationId, aiEnabled: false },
      };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message || String(err) };
    }
  }
}
