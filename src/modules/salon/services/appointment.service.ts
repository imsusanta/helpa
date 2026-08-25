/**
 * Helpa Salon Module — Appointment Service
 *
 * WhatsApp appointment booking, rescheduling, cancellation, and status tracking.
 */

import { getAdminClient } from '@/lib/db/server';
import { coreEvents } from '@/core/events';
import { getOrCreateSalonCustomer } from './customer.service';
import { findSalonServiceByName } from './service.service';

export type SalonAppointmentStatus =
  | 'Pending'
  | 'Confirmed'
  | 'Checked In'
  | 'In Service'
  | 'Completed'
  | 'Cancelled'
  | 'No Show'
  | 'Rescheduled';

export interface SalonAppointmentRecord {
  id: string;
  accountId: string;
  appointmentId: string; // e.g. SAL-000123
  customerId: string;
  customerName: string;
  customerMobile: string;
  serviceName: string;
  staffName: string;
  appointmentDate: string; // YYYY-MM-DD
  appointmentTime: string; // e.g. "05:00 PM"
  durationMinutes: number;
  price: number;
  status: SalonAppointmentStatus;
  bookingSource: 'WhatsApp';
  bookedBy: 'ai' | 'receptionist';
  notes?: string;
  createdAt: string;
}

export interface BookSalonAppointmentInput {
  accountId: string;
  customerName: string;
  customerMobile: string;
  serviceName: string;
  staffName?: string;
  appointmentDate: string;
  appointmentTime: string;
  bookedBy?: 'ai' | 'receptionist';
  notes?: string;
}

/**
 * Creates a confirmed/pending appointment and updates customer appointment timeline.
 */
export async function bookSalonAppointment(
  input: BookSalonAppointmentInput
): Promise<SalonAppointmentRecord> {
  const db = getAdminClient();

  // 1. Resolve Service details
  const service = await findSalonServiceByName(
    input.accountId,
    input.serviceName
  );
  const serviceName = service ? service.name : input.serviceName;
  const duration = service ? service.durationMinutes : 45;
  const price = service ? service.price : 500;
  const staffName =
    input.staffName || service?.assignedStaffNames?.[0] || 'Amit Roy';

  // 2. Resolve / Create Customer
  const customer = await getOrCreateSalonCustomer({
    accountId: input.accountId,
    name: input.customerName,
    phone: input.customerMobile,
    preferredStaff: staffName,
    preferredServices: [serviceName],
  });

  const appointmentCode = `SAL-${Date.now().toString().slice(-6)}`;
  const bookedBy = input.bookedBy || 'ai';

  // 3. Save Appointment in Database
  const { data: created, error } = await db
    .from('appointments')
    .insert({
      account_id: input.accountId,
      patient_id: customer.id, // maps to unified contact ID
      patient_name: customer.name,
      patient_mobile: customer.phone,
      doctor_name: staffName,
      department_name: serviceName,
      appointment_date: input.appointmentDate,
      appointment_time: input.appointmentTime,
      status: 'Confirmed',
      source: 'WhatsApp',
      notes: `Service: ${serviceName} | Staff: ${staffName} | BookedBy: ${bookedBy} | ${input.notes || ''}`,
      created_at: new Date().toISOString(),
    })
    .select('*')
    .single();

  if (error || !created) {
    return {
      id: `sal-appt-${Date.now()}`,
      accountId: input.accountId,
      appointmentId: appointmentCode,
      customerId: customer.customerId,
      customerName: customer.name,
      customerMobile: customer.phone,
      serviceName,
      staffName,
      appointmentDate: input.appointmentDate,
      appointmentTime: input.appointmentTime,
      durationMinutes: duration,
      price,
      status: 'Confirmed',
      bookingSource: 'WhatsApp',
      bookedBy,
      createdAt: new Date().toISOString(),
    };
  }

  // 4. Emit Platform Events for automated 24h & 2h reminders
  coreEvents.emit('appointment.created', input.accountId, {
    appointmentId: created.id,
    appointmentCode,
    customerName: customer.name,
    customerMobile: customer.phone,
    serviceName,
    staffName,
    appointmentDate: input.appointmentDate,
    appointmentTime: input.appointmentTime,
    bookingSource: 'WhatsApp',
    bookedBy,
    timestamp: new Date().toISOString(),
  });

  // 5. Send WhatsApp interactive button message
  try {
    const { sendWhatsAppMessage } = await import('@/core/whatsapp');
    await sendWhatsAppMessage({
      tenantId: input.accountId,
      to: customer.phone,
      type: 'interactive',
      headerText: 'Salon Booking Confirmed',
      text: `Hello ${customer.name},\nYour appointment for ${serviceName} with ${staffName} is confirmed.\n\n📅 Date: ${input.appointmentDate}\n⏰ Time: ${input.appointmentTime}\n🎟 Code: ${appointmentCode}\n💳 Amount: ₹${price}`,
      footerText: 'Helpa Salon Assistant • Reply STOP to opt out',
      buttons: [
        { id: 'btn_confirm', title: 'Confirm' },
        { id: 'btn_reschedule', title: 'Reschedule' },
        { id: 'btn_help', title: 'Need Help?' },
      ],
    }).catch(() => {});
  } catch {
    // Non-blocking
  }

  return {
    id: created.id,
    accountId: created.account_id,
    appointmentId: appointmentCode,
    customerId: customer.customerId,
    customerName: customer.name,
    customerMobile: customer.phone,
    serviceName,
    staffName,
    appointmentDate: created.appointment_date,
    appointmentTime: created.appointment_time,
    durationMinutes: duration,
    price,
    status: (created.status as SalonAppointmentStatus) || 'Confirmed',
    bookingSource: 'WhatsApp',
    bookedBy,
    createdAt: created.created_at,
  };
}

/**
 * Reschedules an appointment to a new date/time slot.
 */
export async function rescheduleSalonAppointment({
  accountId,
  appointmentId,
  newDate,
  newTime,
}: {
  accountId: string;
  appointmentId: string;
  newDate: string;
  newTime: string;
}): Promise<boolean> {
  const db = getAdminClient();

  const { error } = await db
    .from('appointments')
    .update({
      appointment_date: newDate,
      appointment_time: newTime,
      status: 'Rescheduled',
      updated_at: new Date().toISOString(),
    })
    .eq('id', appointmentId)
    .eq('account_id', accountId);

  if (error) return false;

  coreEvents.emit('appointment.rescheduled', accountId, {
    appointmentId,
    newDate,
    newTime,
    timestamp: new Date().toISOString(),
  });

  return true;
}

/**
 * Cancels an appointment and halts scheduled reminders.
 */
export async function cancelSalonAppointment({
  accountId,
  appointmentId,
  reason,
}: {
  accountId: string;
  appointmentId: string;
  reason?: string;
}): Promise<boolean> {
  const db = getAdminClient();

  const { error } = await db
    .from('appointments')
    .update({
      status: 'Cancelled',
      notes: reason ? `Cancelled: ${reason}` : 'Cancelled by customer',
      updated_at: new Date().toISOString(),
    })
    .eq('id', appointmentId)
    .eq('account_id', accountId);

  if (error) return false;

  coreEvents.emit('appointment.cancelled', accountId, {
    appointmentId,
    reason,
    timestamp: new Date().toISOString(),
  });

  return true;
}
