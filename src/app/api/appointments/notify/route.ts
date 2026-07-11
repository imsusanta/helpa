import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/automations/admin-client';
import { engineSendText, engineSendDocument } from '@/lib/automations/meta-send';

export async function POST(request: Request) {
  try {
    const { appointmentId, accountId } = await request.json();
    if (!appointmentId || !accountId) {
      return NextResponse.json({ error: 'Missing appointmentId or accountId' }, { status: 400 });
    }

    const db = supabaseAdmin();

    // Fetch appointment with patient contact and doctor details
    const { data: appt, error: apptErr } = await db
      .from('appointments')
      .select('*, patient:contacts(id, name, phone), doctor:hospital_doctors(id, name)')
      .eq('id', appointmentId)
      .single();

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
    const pdfUrl = `https://helpa.studio/api/appointments/${appt.id}/pdf`;
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
  } catch (err: any) {
    console.error('Failed to resend appointment slip:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
