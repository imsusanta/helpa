import { leadsRepository } from '@/lib/db/repositories';
import { appointmentsRepository } from '@/lib/db/repositories';
import { auditLogsRepository } from '@/lib/db/repositories';
import { getAdminClient } from '@/lib/db/server';
import { DefaultCalendlyProvider } from '../providers/calendly/calendly-provider';
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

  // 1. Transition lead stage using the tenant-scoped leads repository.
  async transitionLead(params: {
    leadId: string;
    nextStage: LeadStageType;
    reason?: string;
    source?: string;
  }): Promise<ActionResult> {
    try {
      const updatedLead = await leadsRepository.updateStage(
        this.context.accountId,
        params.leadId,
        params.nextStage,
        this.context.actorId || 'system',
        this.context.idempotencyKey
      );

      return {
        success: true,
        data: updatedLead,
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
    try {
      const provider = new DefaultCalendlyProvider();
      const eventTypeUri = params.eventTypeId || 'default_event_type';

      // Call real Calendly booking client
      const booking = await provider.createBooking(this.context.accountId, {
        eventTypeId: eventTypeUri,
        startAt: params.startAt,
        patientName: params.patientName,
        patientEmail:
          params.patientEmail ||
          `${params.patientPhone.replace(/[^0-9]/g, '')}@clinic.local`,
        patientPhone: params.patientPhone,
        notes: `Booked via WACRM for service: ${params.serviceName || 'Consultation'}`,
      });

      // Insert appointment record in Appwrite Databases
      const appt = await appointmentsRepository.createAppointment(
        this.context.accountId,
        {
          title: `${params.patientName} - ${params.serviceName || 'Consultation'}`,
          startTime: params.startAt,
          endTime: params.startAt,
          status: 'scheduled',
          source: 'calendly_ai',
        }
      );

      // Log audit entry
      await auditLogsRepository.createAuditLog(
        this.context.accountId,
        this.context.actorId,
        'calendly.booking_created',
        'appointments',
        appt.$id,
        {
          startAt: params.startAt,
          patientName: params.patientName,
          bookingUri: booking.bookingUri,
        }
      );

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
          appointmentId: appt.$id,
          status: 'Confirmed',
          bookingUri: booking.bookingUri,
          inviteeUri: booking.inviteeUri,
        },
      };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message || String(err) };
    }
  }

  // 3. Human Handoff (Pause AI & Alert Staff / Agent)
  async handoffToHuman(params: {
    conversationId: string;
    reason: string;
    leadId?: string;
    assignedAgentId?: string;
  }): Promise<ActionResult> {
    try {
      const updateData: Record<string, unknown> = {
        ai_chat_enabled: false,
        updated_at: new Date().toISOString(),
      };
      if (params.assignedAgentId) {
        updateData.assigned_agent_id = params.assignedAgentId;
      }

      await getAdminClient()
        .from('conversations')
        .update(updateData)
        .eq('id', params.conversationId)
        .eq('account_id', this.context.accountId);

      await auditLogsRepository.createAuditLog(
        this.context.accountId,
        this.context.actorId,
        'conversation.human_handoff',
        'conversations',
        params.conversationId,
        {
          reason: params.reason,
          leadId: params.leadId,
          assignedAgentId: params.assignedAgentId,
        }
      );

      return {
        success: true,
        data: { conversationId: params.conversationId, aiEnabled: false },
      };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message || String(err) };
    }
  }
}
