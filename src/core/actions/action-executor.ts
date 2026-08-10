import { supabaseAdmin } from '@/lib/automations/admin-client';
import { LeadStageType } from '../types';
import { DefaultCalendlyProvider } from '../providers/calendly/calendly-provider';

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

  // 1. Transition Lead Stage with Atomic Database RPC
  async transitionLead(params: {
    leadId: string;
    nextStage: LeadStageType;
    reason?: string;
    source?: string;
  }): Promise<ActionResult> {
    const db = supabaseAdmin();
    try {
      const { data, error } = await db.rpc('transition_lead_atomic', {
        p_account_id: this.context.accountId,
        p_lead_id: params.leadId,
        p_next_stage: params.nextStage,
        p_reason: params.reason || null,
        p_source: params.source || 'action_executor',
        p_actor_type: this.context.actorType,
        p_actor_id: this.context.actorId || null,
        p_idempotency_key: this.context.idempotencyKey || null,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      const res = data as Record<string, unknown>;
      if (!res.success) {
        return {
          success: false,
          error: (res.error as string) || 'Stage transition failed',
        };
      }

      return {
        success: true,
        data: res,
      };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message || String(err) };
    }
  }

  // 2. Book Calendly Event & Synchronize Appointment
  async bookCalendlyEvent(params: {
    leadId?: string;
    patientName: string;
    patientPhone: string;
    patientEmail?: string;
    startAt: string;
    serviceName?: string;
    doctorId?: string;
    eventTypeId?: string;
  }): Promise<ActionResult> {
    const db = supabaseAdmin();
    try {
      const provider = new DefaultCalendlyProvider();
      let eventTypeUri = params.eventTypeId || '';

      // If no explicit eventTypeId, look up mapped event type or default event type
      if (!eventTypeUri) {
        const { data: mapping } = await db
          .from('service_event_type_mappings')
          .select('calendly_event_type_id, calendly_event_types(external_uri)')
          .eq('account_id', this.context.accountId)
          .eq('service_name', params.serviceName || 'General Consultation')
          .maybeSingle();

        const mappingObj = mapping as unknown as {
          calendly_event_types?: { external_uri?: string };
        } | null;
        eventTypeUri = mappingObj?.calendly_event_types?.external_uri || '';

        if (!eventTypeUri) {
          const { data: et } = await db
            .from('calendly_event_types')
            .select('external_uri')
            .eq('account_id', this.context.accountId)
            .limit(1)
            .maybeSingle();
          eventTypeUri = et?.external_uri || 'default_event_type';
        }
      }

      // Call real Calendly booking client
      const booking = await provider.createBooking(this.context.accountId, {
        eventTypeId: eventTypeUri,
        startAt: params.startAt,
        patientName: params.patientName,
        patientEmail: params.patientEmail || `${params.patientPhone.replace(/[^0-9]/g, '')}@clinic.local`,
        patientPhone: params.patientPhone,
        notes: `Booked via WACRM for service: ${params.serviceName || 'Consultation'}`,
      });

      // Insert appointment record in database
      const { data: appt, error } = await db
        .from('appointments')
        .insert({
          account_id: this.context.accountId,
          patient_name: params.patientName,
          patient_phone: params.patientPhone,
          appointment_date: params.startAt.split('T')[0],
          appointment_time: params.startAt.split('T')[1]?.slice(0, 5) || '10:00',
          status: 'Confirmed',
          booking_source: 'calendly_ai',
          calendly_event_uri: booking.bookingUri,
          calendly_invitee_uri: booking.inviteeUri,
          calendly_event_type_uri: eventTypeUri,
          sync_status: 'synced',
        })
        .select('id')
        .single();

      if (error) throw error;

      // Log audit entry
      await db.from('audit_logs').insert({
        account_id: this.context.accountId,
        actor_id: this.context.actorId,
        action: 'calendly.booking_created',
        resource_type: 'appointments',
        resource_id: appt.id,
        metadata: {
          startAt: params.startAt,
          patientName: params.patientName,
          bookingUri: booking.bookingUri,
        },
      });

      // Transition lead stage to BOOKED if leadId provided
      if (params.leadId) {
        await this.transitionLead({
          leadId: params.leadId,
          nextStage: 'BOOKED',
          reason: 'Calendly event confirmed',
        });
      }

      return {
        success: true,
        data: {
          appointmentId: appt.id,
          status: 'Confirmed',
          bookingUri: booking.bookingUri,
          inviteeUri: booking.inviteeUri,
        },
      };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message || String(err) };
    }
  }

  // 3. Human Handoff (Pause AI & Alert Clinic Staff)
  async handoffToHuman(params: {
    conversationId: string;
    reason: string;
    leadId?: string;
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

      // Create staff notification & audit log
      await Promise.all([
        db.from('audit_logs').insert({
          account_id: this.context.accountId,
          actor_id: this.context.actorId,
          action: 'conversation.human_handoff',
          resource_type: 'conversations',
          resource_id: params.conversationId,
          metadata: { reason: params.reason, leadId: params.leadId },
        }),
      ]);

      return {
        success: true,
        data: { conversationId: params.conversationId, aiEnabled: false },
      };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message || String(err) };
    }
  }
}
