/**
 * Helpa Health Module — Appointment Service
 *
 * Core appointment creation, token generation, queue tracking,
 * reminder scheduling, and cancellation/rescheduling.
 */

import { getAdminClient } from '@/lib/appwrite-server-compat';
import { coreEvents } from '@/core/events';
import { createOrFindPatient } from './patient.service';
import { getDoctorSlotAvailability, listClinicDoctors } from './doctor.service';
import { generateAppointmentSlipText } from './appointment-pdf.service';

export interface CreateHealthAppointmentInput {
  accountId: string;
  patientName: string;
  patientMobile: string;
  doctorIdOrName: string;
  appointmentDate: string; // YYYY-MM-DD
  appointmentTime: string; // e.g. "10:30 AM"
  bookedBy?: 'ai' | 'receptionist';
  notes?: string;
  gender?: string;
  dob?: string;
}

export interface HealthAppointmentResult {
  appointmentId: string;
  patientId: string; // PT-XXXXXX
  patientName: string;
  patientMobile: string;
  doctorName: string;
  department: string;
  appointmentDate: string;
  appointmentTime: string;
  tokenNumber: string;
  bookingSource: 'WhatsApp' | 'Reception';
  bookedBy: 'ai' | 'receptionist';
  confirmationSlip: string;
}

/**
 * Generates an appointment queue token (e.g. A-018) for the day.
 */
async function generateQueueToken(
  accountId: string,
  dateStr: string
): Promise<string> {
  const db = getAdminClient();
  const { data: appts } = await db
    .from('appointments')
    .select('id')
    .eq('account_id', accountId)
    .eq('appointment_date', dateStr);

  const count = (appts?.length || 0) + 1;
  return `A-${count.toString().padStart(3, '0')}`;
}

/**
 * Books an appointment in the Health workspace.
 */
export async function bookHealthAppointment(
  input: CreateHealthAppointmentInput
): Promise<HealthAppointmentResult> {
  const db = getAdminClient();

  // 1. Resolve or create Patient
  const patient = await createOrFindPatient({
    accountId: input.accountId,
    name: input.patientName,
    phone: input.patientMobile,
    gender: input.gender,
    dob: input.dob,
    notes: input.notes,
  });

  // 2. Validate Doctor Availability
  const availability = await getDoctorSlotAvailability(
    input.accountId,
    input.doctorIdOrName,
    input.appointmentDate
  );

  const doctors = await listClinicDoctors(input.accountId);
  const doctor =
    doctors.find((d) => d.id === availability.doctorId) ||
    doctors.find((d) =>
      d.name.toLowerCase().includes(input.doctorIdOrName.toLowerCase())
    ) ||
    doctors[0];

  const doctorName = doctor ? doctor.name : input.doctorIdOrName;
  const department = doctor ? doctor.department : 'General Medicine';
  const fee = doctor ? doctor.consultationFee : 500;

  // 3. Duplicate booking prevention
  const { data: existingAppts } = await db
    .from('appointments')
    .select('id, status, extra_attributes')
    .eq('account_id', input.accountId)
    .eq('appointment_date', input.appointmentDate)
    .eq('appointment_time', input.appointmentTime)
    .neq('status', 'Cancelled');

  if (existingAppts && existingAppts.length > 0) {
    const hasConflict = existingAppts.some((a) => {
      const extra = (a.extra_attributes as Record<string, unknown>) || {};
      return (
        extra.doctor_name === doctorName ||
        (a.doctor_name && a.doctor_name === doctorName)
      );
    });
    if (hasConflict) {
      throw new Error(
        `Duplicate booking prevented: Dr. ${doctorName} is already booked on ${input.appointmentDate} at ${input.appointmentTime}.`
      );
    }
  }

  // 4. Generate Token Number
  const tokenNumber = await generateQueueToken(
    input.accountId,
    input.appointmentDate
  );
  const bookingSource = 'WhatsApp';
  const bookedBy = input.bookedBy || 'ai';

  // 5. Insert into database
  const extraAttributes = {
    patient_id: patient.patientId,
    token_number: tokenNumber,
    booking_source: bookingSource,
    booked_by: bookedBy,
    department,
    doctor_name: doctorName,
    fee,
  };

  const { data: created, error } = await db
    .from('appointments')
    .insert({
      account_id: input.accountId,
      contact_id: patient.id,
      appointment_date: input.appointmentDate,
      appointment_time: input.appointmentTime,
      notes: `Dr. ${doctorName} (${department}) | Token: ${tokenNumber} | Booked by ${bookedBy}`,
      status: 'Confirmed',
      extra_attributes: extraAttributes,
      created_at: new Date().toISOString(),
    })
    .select('*')
    .single();

  if (error || !created) {
    throw new Error(
      `Appointment creation failed: ${error?.message || 'Database error'}`
    );
  }

  // 5. Generate confirmation slip
  const confirmationSlip = generateAppointmentSlipText({
    clinicName: 'City Care Clinic',
    patientName: patient.name,
    patientId: patient.patientId,
    patientMobile: patient.phone,
    doctorName,
    department,
    consultationFee: fee,
    appointmentDate: input.appointmentDate,
    appointmentTime: input.appointmentTime,
    tokenNumber,
    bookingSource,
    bookingCreatedAt: new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    }),
  });

  // 6. Emit appointment.created event to trigger 24h/2h reminders
  coreEvents.emit('appointment.created', input.accountId, {
    appointmentId: created.id,
    patientId: patient.patientId,
    patientName: patient.name,
    patientMobile: patient.phone,
    doctorName,
    date: input.appointmentDate,
    time: input.appointmentTime,
    tokenNumber,
    timestamp: new Date().toISOString(),
  });

  return {
    appointmentId: created.id,
    patientId: patient.patientId,
    patientName: patient.name,
    patientMobile: patient.phone,
    doctorName,
    department,
    appointmentDate: input.appointmentDate,
    appointmentTime: input.appointmentTime,
    tokenNumber,
    bookingSource,
    bookedBy,
    confirmationSlip,
  };
}

/**
 * Updates Queue status for a clinic appointment.
 */
export async function updateQueueStatus(
  accountId: string,
  appointmentId: string,
  newStatus:
    | 'Waiting'
    | 'Now Serving'
    | 'In Consultation'
    | 'Completed'
    | 'Cancelled'
    | 'No Show'
): Promise<boolean> {
  const db = getAdminClient();
  const { error } = await db
    .from('appointments')
    .update({
      status: newStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', appointmentId)
    .eq('account_id', accountId);

  return !error;
}
