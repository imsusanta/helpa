import { NextRequest, NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { getAdminClient as getSupabaseAdminClient } from '@/lib/supabase/server';
import {
  cancelPendingAppointmentReminders,
  scheduleAppointmentReminders,
} from '@/lib/automations/appointment-triggers';
import { runAutomationsForTrigger } from '@/lib/automations/engine';

const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store, no-cache, must-revalidate',
};

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const context = await requireRole('agent');
    const supabase = getSupabaseAdminClient();
    const body = await request.json();
    const { data: existing, error: existingError } = await supabase
      .from('appointments')
      .select('id, patient_id, appointment_date, appointment_time, status')
      .eq('id', id)
      .eq('account_id', context.accountId)
      .single();
    if (existingError || !existing) {
      return NextResponse.json(
        { error: existingError?.message || 'Appointment not found' },
        {
          status: existingError ? 500 : 404,
          headers: PRIVATE_HEADERS,
        }
      );
    }

    const updatePayload: Record<string, unknown> = {};
    if (body.status !== undefined) updatePayload.status = body.status;
    if (body.doctor_id !== undefined) {
      updatePayload.doctor_id = body.doctor_id || null;
    }
    if (body.appointment_date !== undefined) {
      updatePayload.appointment_date = body.appointment_date;
    }
    if (body.appointment_time !== undefined) {
      updatePayload.appointment_time = body.appointment_time;
    }
    if (body.department !== undefined) {
      updatePayload.department = body.department || null;
    }
    if (body.notes !== undefined) updatePayload.notes = body.notes || null;
    updatePayload.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('appointments')
      .update(updatePayload)
      .eq('id', id)
      .eq('account_id', context.accountId)
      .select(
        'id, patient_id, booking_id, appointment_date, appointment_time, status, notes, department, token_number, queue_position, created_at, patient:contacts(id, name, phone), doctor:hospital_doctors(id, name, specialization, department)'
      )
      .single();
    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500, headers: PRIVATE_HEADERS }
      );
    }

    if (data?.patient_id) {
      const appointmentChanged =
        existing.appointment_date !== data.appointment_date ||
        existing.appointment_time !== data.appointment_time;
      const wasCancelled = ['cancelled', 'canceled'].includes(
        String(existing.status).toLowerCase()
      );
      const isCancelled = ['cancelled', 'canceled'].includes(
        String(data.status).toLowerCase()
      );

      if (appointmentChanged || isCancelled) {
        await cancelPendingAppointmentReminders(context.accountId, data.id);
      }
      if (appointmentChanged && !isCancelled) {
        void scheduleAppointmentReminders({
          accountId: context.accountId,
          userId: context.userId,
          contactId: data.patient_id,
          appointmentId: data.id,
          appointmentDate: data.appointment_date,
          appointmentTime: data.appointment_time,
        });
      }
      if (!wasCancelled && isCancelled) {
        void runAutomationsForTrigger({
          accountId: context.accountId,
          triggerType: 'appointment_cancelled',
          contactId: data.patient_id,
          context: {
            vars: {
              appointment_id: data.id,
              appointment_date: data.appointment_date,
              appointment_time: data.appointment_time,
              booking_id: data.booking_id,
            },
          },
        });
      }
    }
    return NextResponse.json({ data }, { headers: PRIVATE_HEADERS });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const context = await requireRole('admin');
    const supabase = getSupabaseAdminClient();
    await cancelPendingAppointmentReminders(context.accountId, id);
    const { error } = await supabase
      .from('appointments')
      .delete()
      .eq('id', id)
      .eq('account_id', context.accountId);
    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500, headers: PRIVATE_HEADERS }
      );
    }
    return NextResponse.json({ success: true }, { headers: PRIVATE_HEADERS });
  } catch (err) {
    return toErrorResponse(err);
  }
}
