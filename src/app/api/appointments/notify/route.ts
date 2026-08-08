import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/automations/admin-client';
import {
  engineSendText,
  engineSendDocument,
} from '@/lib/automations/meta-send';
import { generatePdfToken } from '@/lib/pdf-signing';

export async function POST(request: NextRequest) {
  try {
    const userClient = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await userClient.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const { data: profile } = await supabaseAdmin()
      .from('profiles')
      .select('account_id, role')
      .eq('user_id', user.id)
      .maybeSingle();

    const accountId = profile?.account_id;
    if (!accountId) {
      return NextResponse.json(
        {
          error: 'FORBIDDEN',
          message: 'User is not associated with an account',
        },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => null);
    const appointmentId = body?.appointmentId;

    if (!appointmentId) {
      return NextResponse.json(
        { error: 'BAD_REQUEST', message: 'Missing appointmentId' },
        { status: 400 }
      );
    }

    const db = supabaseAdmin();

    // Fetch appointment with patient contact and doctor details — scoped to caller's account_id
    const { data: appt, error: apptErr } = await db
      .from('appointments')
      .select(
        '*, patient:contacts(id, name, phone, account_id), doctor:hospital_doctors(id, name)'
      )
      .eq('id', appointmentId)
      .eq('account_id', accountId)
      .single();

    if (apptErr || !appt) {
      return NextResponse.json(
        {
          error: 'APPOINTMENT_NOT_FOUND',
          message: 'Appointment not found or access denied',
        },
        { status: 404 }
      );
    }

    const patientName = appt.patient?.name || 'Patient';
    const patientPhone = appt.patient?.phone;
    const contactId = appt.patient?.id;

    if (!patientPhone || !contactId || appt.patient?.account_id !== accountId) {
      return NextResponse.json(
        {
          error: 'PATIENT_NOT_FOUND',
          message: 'Patient contact details not found or access denied',
        },
        { status: 404 }
      );
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
        .insert({
          account_id: accountId,
          contact_id: contactId,
          status: 'open',
        })
        .select('id')
        .single();
      conv = newConv;
    }

    if (!conv) {
      return NextResponse.json(
        {
          error: 'CONVERSATION_ERROR',
          message: 'Failed to find/create conversation',
        },
        { status: 500 }
      );
    }

    // Fetch account name for hospital branding
    const { data: account } = await db
      .from('accounts')
      .select('name')
      .eq('id', accountId)
      .single();

    const doctorName = appt.doctor?.name
      ? `Dr. ${appt.doctor.name.replace(/^Dr\.\s+/i, '')}`
      : 'On-Duty Physician';

    const bookingIdStr =
      appt.booking_id || `APT-2026-${appt.id.slice(0, 5).toUpperCase()}`;

    // Compute canonical base URL dynamically
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      request.nextUrl.origin;

    // Generate signed PDF access token (valid for 7 days)
    const expiresAt = Math.floor(Date.now() / 1000) + 7 * 86400;
    const token = generatePdfToken({
      appointmentId: appt.id,
      accountId,
      expiresAt,
    });
    const pdfUrl = `${baseUrl}/api/appointments/${appt.id}/pdf?token=${encodeURIComponent(token)}`;

    // Formulate confirmation message
    const messageText = `✅ *APPOINTMENT SLIP RESENT!*

📋 *Booking ID:* ${bookingIdStr}
🔢 *Token Number:* #${appt.token_number || 1}
📍 *Queue Position:* ${appt.queue_position || 1}
👨‍⚕️ *Doctor:* ${doctorName}
🏥 *Department:* ${appt.department || 'General Medicine'}
📅 *Date & Time:* ${appt.appointment_date} at ${appt.appointment_time}

📄 Download your digital ticket PDF:
${pdfUrl}

Please arrive 15 minutes before your time slot. Thank you!`;

    // 1. Send text confirmation
    await engineSendText({
      accountId,
      userId: user.id,
      conversationId: conv.id,
      contactId,
      text: messageText,
    });

    // 2. Send PDF slip via WhatsApp
    await engineSendDocument({
      accountId,
      userId: user.id,
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
      user_id: user.id,
      content: `Resent appointment token slip (${bookingIdStr}) via WhatsApp.`,
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error(
      '[POST /api/appointments/notify] Failed to resend appointment slip:',
      err
    );
    return NextResponse.json(
      {
        error: 'APPOINTMENT_NOTIFY_FAILED',
        message: 'Failed to process notification request',
      },
      { status: 500 }
    );
  }
}
