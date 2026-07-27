import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/automations/admin-client';
import { engineSendText, engineSendDocument } from '@/lib/automations/meta-send';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { buildAppointmentPdfUrl } from '@/lib/security/signed-links';

/**
 * Resend an appointment slip to the patient over WhatsApp.
 *
 * Auth: requires a signed-in member. `accountId` is taken from the session,
 * never from the request body — the previous version accepted both ids from
 * an unauthenticated body and looked the appointment up by id alone, so any
 * caller could make one clinic send another clinic's appointment details.
 */
export async function POST(request: Request) {
  let accountId: string;
  try {
    const ctx = await requireRole('agent');
    accountId = ctx.accountId;
  } catch (err) {
    return toErrorResponse(err);
  }

  try {
    const { appointmentId } = await request.json();
    if (!appointmentId || typeof appointmentId !== 'string') {
      return NextResponse.json({ error: 'Missing appointmentId' }, { status: 400 });
    }

    const db = supabaseAdmin();

    // Fetch appointment with patient contact and doctor details.
    // The account_id filter is what proves the caller owns this row.
    const { data: appt, error: apptErr } = await db
      .from('appointments')
      .select('*, patient:contacts(id, name, phone), doctor:hospital_doctors(id, name)')
      .eq('id', appointmentId)
      .eq('account_id', accountId)
      .single();

    // Same 404 for "absent" and "belongs to another account", so the response
    // cannot be used to probe for appointment ids in other tenants.
    if (apptErr || !appt) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });
    }

    const patientName = appt.patient?.name || 'Patient';
    const patientPhone = appt.patient?.phone;
    const contactId = appt.patient?.id;

    if (!patientPhone || !contactId) {
      return NextResponse.json({ error: 'Patient contact details not found' }, { status: 404 });
    }

    // Find or create conversation
    let { data: conv } = await db
      .from('conversations')
      .select('id')
      .eq('contact_id', contactId)
      .eq('account_id', accountId)
      .maybeSingle();

    if (!conv) {
      const { data: newConv } = await db
        .from('conversations')
        .insert({ account_id: accountId, contact_id: contactId, status: 'open' })
        .select('id')
        .single();
      conv = newConv;
    }

    if (!conv) {
      return NextResponse.json({ error: 'Failed to find/create conversation' }, { status: 500 });
    }

    // Fetch account name for hospital branding
    const { data: account } = await db
      .from('accounts')
      .select('name')
      .eq('id', accountId)
      .single();

    const hospitalName = account?.name || 'Hospital';
    const doctorName = appt.doctor?.name
      ? `Dr. ${appt.doctor.name.replace(/^Dr\.\s+/i, '')}`
      : 'On-Duty Physician';

    const bookingIdStr = appt.booking_id || `APT-2026-${appt.id.slice(0, 5).toUpperCase()}`;
    // Signed, 7-day, single-appointment link. Meta fetches this URL
    // server-side to build the attachment and the patient may tap it in the
    // message body — both are unauthenticated, so the token is what makes
    // either work now that the route is no longer public.
    const pdfUrl = buildAppointmentPdfUrl(appt.id, accountId);
    const systemUserId = '00000000-0000-0000-0000-000000000000';

    // Formulate confirmation message
    const messageText = `✅ *APPOINTMENT SLIP RESENT!*

*Booking ID:* ${bookingIdStr}
*Token Number:* #${appt.token_number || 1}
*Queue Position:* ${appt.queue_position || 1}
*Doctor:* ${doctorName}
*Department:* ${appt.department || 'General Medicine'}
*Date & Time:* ${appt.appointment_date} at ${appt.appointment_time}

Download your digital ticket PDF:
${pdfUrl}

Please arrive 15 minutes before your time slot. Thank you!`;

    // 1. Send text confirmation
    await engineSendText({
      accountId,
      userId: systemUserId,
      conversationId: conv.id,
      contactId,
      text: messageText,
    });

    // 2. Send PDF slip via WhatsApp
    await engineSendDocument({
      accountId,
      userId: systemUserId,
      conversationId: conv.id,
      contactId,
      documentUrl: pdfUrl,
      filename: `appointment-${bookingIdStr}.pdf`,
      caption: `Digital Appointment Ticket for ${doctorName}`,
    });

    // 3. Create a timeline note
    await db.from('contact_notes').insert({
      account_id: accountId,
      contact_id: contactId,
      user_id: null,
      content: `Resent appointment token slip (${bookingIdStr}) via WhatsApp.`,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    // No PII and no raw err.message on the wire.
    console.error('[appointments/notify] failed to resend appointment slip:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
