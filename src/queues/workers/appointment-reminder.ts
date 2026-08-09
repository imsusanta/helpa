import { Job, UnrecoverableError } from 'bullmq';
import { supabaseAdmin } from '@/lib/automations/admin-client';
import { engineSendButtons } from '@/lib/automations/meta-send';
import {
  APPOINTMENT_REMINDER_JOB,
  type AppointmentReminderJobData,
} from '@/queues/producers/appointment-reminders';

const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';
const ACTIVE_APPOINTMENT_STATUSES = new Set([
  'pending',
  'scheduled',
  'reminder sent',
  'pending-confirmation',
]);

function fillTemplate(
  template: string,
  variables: Record<string, string>
): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }
  return result;
}

export async function processFollowupJob(
  job: Job<AppointmentReminderJobData>
): Promise<void> {
  if (job.name !== APPOINTMENT_REMINDER_JOB) {
    console.warn('[Worker: followups] Ignoring unsupported job', {
      jobId: job.id,
      jobName: job.name,
    });
    return;
  }

  const { accountId, appointmentId, reminderType } = job.data;
  if (!accountId || !appointmentId || !['24h', '2h'].includes(reminderType)) {
    throw new UnrecoverableError('Invalid appointment reminder job');
  }

  const db = supabaseAdmin();
  const { data: appointment, error: appointmentError } = await db
    .from('appointments')
    .select(
      'id, account_id, patient_id, department, appointment_date, appointment_time, status, token_number, reminder_24h_sent, reminder_2h_sent, doctor:hospital_doctors(id, name, department)'
    )
    .eq('id', appointmentId)
    .eq('account_id', accountId)
    .maybeSingle();

  if (appointmentError) throw new Error('Unable to load appointment');
  if (!appointment) throw new UnrecoverableError('Appointment not found');

  if (
    !ACTIVE_APPOINTMENT_STATUSES.has(String(appointment.status).toLowerCase())
  ) {
    return;
  }
  if (
    (reminderType === '24h' && appointment.reminder_24h_sent) ||
    (reminderType === '2h' && appointment.reminder_2h_sent)
  ) {
    return;
  }

  const [
    { data: account, error: accountError },
    { data: contact, error: contactError },
  ] = await Promise.all([
    db
      .from('accounts')
      .select('id, name, reminder_template')
      .eq('id', accountId)
      .single(),
    db
      .from('contacts')
      .select('id, name, phone')
      .eq('id', appointment.patient_id)
      .eq('account_id', accountId)
      .single(),
  ]);

  if (accountError) throw new Error('Unable to load reminder template');
  if (contactError || !contact?.phone) {
    throw new UnrecoverableError('Patient contact is unavailable');
  }

  let { data: conversation, error: conversationError } = await db
    .from('conversations')
    .select('id')
    .eq('contact_id', appointment.patient_id)
    .eq('account_id', accountId)
    .maybeSingle();

  if (conversationError) throw new Error('Unable to load conversation');
  if (!conversation) {
    const { data: createdConversation, error: createError } = await db
      .from('conversations')
      .insert({
        account_id: accountId,
        contact_id: appointment.patient_id,
        status: 'open',
      })
      .select('id')
      .single();
    if (createError || !createdConversation) {
      throw new Error('Unable to create conversation');
    }
    conversation = createdConversation;
  }

  const doctorData = appointment.doctor as
    | { name?: string; department?: string }
    | Array<{ name?: string; department?: string }>
    | null;
  const doctor = Array.isArray(doctorData) ? doctorData[0] : doctorData;
  const doctorName = doctor?.name || 'Assigned Doctor';
  const department = appointment.department || doctor?.department || 'General';
  const reminderLabel = reminderType === '24h' ? 'tomorrow' : 'in 2 hours';
  const template =
    account.reminder_template ||
    'Hello {{PatientName}}, this is a reminder for your appointment with {{DoctorName}} on {{AppointmentDate}} at {{AppointmentTime}}.';
  const bodyText = fillTemplate(template, {
    PatientName: contact.name || contact.phone,
    HospitalName: account.name || 'Clinic Reception',
    DoctorName: doctorName,
    Department: department,
    AppointmentDate: appointment.appointment_date,
    AppointmentTime: appointment.appointment_time.substring(0, 5),
    TokenNumber: String(appointment.token_number || 'N/A'),
    ReminderTime: reminderLabel,
  });

  await engineSendButtons({
    accountId,
    userId: SYSTEM_USER_ID,
    conversationId: conversation.id,
    contactId: appointment.patient_id,
    bodyText,
    buttons: [
      { id: `rem_confirm_${appointment.id}`, title: 'Confirm' },
      { id: `rem_resched_${appointment.id}`, title: 'Reschedule' },
      { id: `rem_cancel_${appointment.id}`, title: 'Cancel' },
    ],
  });

  const updates: Record<string, unknown> = { status: 'Reminder Sent' };
  updates[reminderType === '24h' ? 'reminder_24h_sent' : 'reminder_2h_sent'] =
    true;
  const { error: updateError } = await db
    .from('appointments')
    .update(updates)
    .eq('id', appointment.id)
    .eq('account_id', accountId);

  // The provider has already accepted the message. Do not retry solely for a
  // bookkeeping failure because that could send a duplicate reminder.
  if (updateError) {
    console.error('[Worker: followups] Reminder sent but flag update failed', {
      accountId,
      appointmentId,
    });
  }

  const { error: noteError } = await db.from('contact_notes').insert({
    account_id: accountId,
    contact_id: appointment.patient_id,
    note_text: `[Timeline] Appointment Reminder Sent (${reminderLabel}) for Dr. ${doctorName} on ${appointment.appointment_date} at ${appointment.appointment_time.substring(0, 5)}.`,
  });
  if (noteError) {
    console.error('[Worker: followups] Reminder timeline write failed', {
      accountId,
      appointmentId,
    });
  }
}
