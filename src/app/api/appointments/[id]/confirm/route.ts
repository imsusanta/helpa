import { NextRequest, NextResponse } from 'next/server';
import { appwriteAdmin } from '@/lib/appwrite-compat';
import {
  engineSendText,
  engineSendDocument,
} from '@/lib/automations/meta-send';
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';

async function generatePdfBuffer(
  appt: Record<string, unknown>,
  hospitalName: string,
  patientSeqId: string,
  ticketSerial: string
): Promise<Buffer> {
  const patient = appt.patient as Record<string, unknown>;
  const doctor = appt.doctor as Record<string, unknown>;
  const bookingId =
    appt.booking_id ||
    `APT-2026-${(appt.id as string).slice(0, 5).toUpperCase()}`;
  const tokenNum = appt.token_number || 1;
  const queuePos = appt.queue_position || 1;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // Watermark
  try {
    doc.saveGraphicsState();
    doc.setTextColor(225, 231, 239);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(hospitalName.length > 25 ? 24 : 32);
    doc.text(hospitalName.toUpperCase(), 105, 145, {
      align: 'center',
      angle: 45,
    });
    doc.restoreGraphicsState();
  } catch (wmErr) {
    console.warn('Watermark error:', wmErr);
  }

  // Header Banner
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 210, 42, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(hospitalName.length > 22 ? 16 : 20);
  doc.text(hospitalName.toUpperCase(), 15, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(203, 213, 225);
  doc.text('OFFICIAL OPD CONSULTATION TICKET & QUEUE TOKEN SLIP', 15, 26);
  doc.text('WhatsApp Helpline & Digital Reception Desk', 15, 32);

  // Emerald Stripe
  doc.setFillColor(16, 185, 129);
  doc.rect(0, 42, 210, 2.5, 'F');

  // Booking Ref
  doc.setFillColor(241, 245, 249);
  doc.rect(15, 52, 180, 22, 'F');

  doc.setTextColor(51, 65, 85);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`BOOKING REF: ${bookingId}`, 20, 60);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `TICKET SERIAL: ${ticketSerial}   |   ISSUED: ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`,
    20,
    67
  );

  // Badge
  doc.setFillColor(16, 185, 129);
  doc.rect(142, 56, 45, 9, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('CONFIRMED', 150, 62);

  // Token Spotlight Card
  doc.setFillColor(236, 253, 245);
  doc.setDrawColor(167, 243, 208);
  doc.rect(15, 82, 180, 46, 'FD');

  doc.setTextColor(6, 95, 70);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('YOUR OPD CONSULTATION TICKET NUMBER', 25, 93);

  doc.setFontSize(40);
  doc.setTextColor(5, 150, 105);
  doc.text(`TOKEN #${tokenNum}`, 25, 117);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text(`Queue Position: #${queuePos}`, 110, 98);

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Patient ID: ${patientSeqId}`, 110, 105);
  doc.text('Status: Verified Active Ticket', 110, 112);
  doc.text('Est. Waiting Time: ~10-15 mins', 110, 119);

  // Details Grids
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.rect(15, 136, 86, 52, 'FD');

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('PATIENT DETAILS', 22, 145);
  doc.line(22, 147, 93, 147);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(51, 65, 85);
  doc.text(`Name: ${patient?.name || 'Patient'}`, 22, 156);
  doc.text(`Patient ID: ${patientSeqId}`, 22, 163);
  doc.text(`Mobile: ${patient?.phone || 'N/A'}`, 22, 170);
  doc.text(`Email: ${patient?.email || 'N/A'}`, 22, 177);

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.rect(109, 136, 86, 52, 'FD');

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('CONSULTATION DETAILS', 116, 145);
  doc.line(116, 147, 187, 147);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(51, 65, 85);
  const dName = doctor?.name as string | undefined;
  const doctorName = dName
    ? dName.startsWith('Dr.')
      ? dName
      : `Dr. ${dName}`
    : 'On-Duty Consultant';
  doc.text(`Doctor: ${doctorName}`, 116, 156);
  doc.text(`Department: ${appt.department || 'General OPD'}`, 116, 163);
  doc.text(`Date: ${appt.appointment_date}`, 116, 170);
  doc.text(`Time Slot: ${appt.appointment_time}`, 116, 177);

  // Instructions Box
  doc.setFillColor(254, 243, 199);
  doc.setDrawColor(252, 211, 77);
  doc.rect(15, 196, 180, 24, 'FD');
  doc.setTextColor(146, 64, 14);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text(
    `IMPORTANT ${hospitalName.toUpperCase()} RECEPTION INSTRUCTIONS:`,
    22,
    203
  );
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(
    '• Please arrive at reception at least 15 minutes before your scheduled appointment slot.',
    22,
    209
  );
  doc.text(
    '• Show this Digital OPD Ticket Slip PDF or your Ticket Token # on your mobile to the token desk.',
    22,
    214
  );

  // QR Code
  const qrDataUrl = await QRCode.toDataURL(
    `OPD-TICKET:${bookingId}|PAT:${patientSeqId}|TOKEN:${tokenNum}`
  );
  doc.addImage(qrDataUrl, 'PNG', 132, 224, 34, 34);

  // Footer
  doc.setDrawColor(226, 232, 240);
  doc.line(15, 272, 195, 272);
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Watermark verified: ${hospitalName} • Official Digital Consultation Ticket Slip`,
    15,
    278
  );

  const arrayBuffer = doc.output('arraybuffer');
  return Buffer.from(arrayBuffer);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: appointmentId } = await params;
    const db = appwriteAdmin();

    // 1. Fetch appointment details safely
    const { data: appt, error: apptErr } = await db
      .from('appointments')
      .select(
        '*, patient:contacts(id, name, phone, email, metadata), doctor:hospital_doctors(id, name, specialization)'
      )
      .eq('id', appointmentId)
      .maybeSingle();

    if (apptErr || !appt) {
      return NextResponse.json(
        { error: 'Appointment not found' },
        { status: 404 }
      );
    }

    const accountId = appt.account_id;
    let contactId = appt.patient?.id || appt.patient_id;
    let patientPhone = appt.patient?.phone;

    // If patient is not linked directly via contacts relation, try finding or creating contact
    if (!contactId && appt.phone) {
      const { data: existingContact } = await db
        .from('contacts')
        .select('id, phone')
        .eq('account_id', accountId)
        .eq('phone', appt.phone)
        .maybeSingle();

      if (existingContact) {
        contactId = existingContact.id;
        patientPhone = existingContact.phone;
      } else {
        const { data: newContact } = await db
          .from('contacts')
          .insert({
            account_id: accountId,
            name: appt.patient_name || 'Patient',
            phone: appt.phone,
          })
          .select('id, phone')
          .single();
        if (newContact) {
          contactId = newContact.id;
          patientPhone = newContact.phone;
        }
      }
    }

    if (!patientPhone || !contactId) {
      return NextResponse.json(
        { error: 'Patient contact details not found' },
        { status: 400 }
      );
    }

    // 2. Find or create conversation
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
        { error: 'Failed to find/create conversation' },
        { status: 500 }
      );
    }

    // 3. Fetch account details & patient ID
    const { data: account } = await db
      .from('accounts')
      .select('name')
      .eq('id', accountId)
      .maybeSingle();

    const hospitalName = account?.name || 'Siliguri Nursing Home';
    const docObj = appt.doctor as { name?: string } | null;
    const doctorName = docObj?.name
      ? docObj.name.startsWith('Dr.')
        ? docObj.name
        : `Dr. ${docObj.name}`
      : 'On-Duty Physician';

    let patientSeqId = 'PAT-000000';
    if (contactId) {
      const { data: patRow } = await db
        .from('patients')
        .select('patient_seq_id')
        .eq('id', contactId)
        .maybeSingle();
      const patObj = appt.patient as {
        metadata?: { patient_id?: string };
      } | null;
      if (patRow?.patient_seq_id) {
        patientSeqId = patRow.patient_seq_id;
      } else if (patObj?.metadata?.patient_id) {
        patientSeqId = patObj.metadata.patient_id;
      } else {
        // Create patient record if it doesn't exist to trigger sequence assignment
        const { data: newPat } = await db
          .from('patients')
          .insert({ id: contactId, account_id: accountId })
          .select('patient_seq_id')
          .maybeSingle();
        if (newPat?.patient_seq_id) {
          patientSeqId = newPat.patient_seq_id;
        }
      }
    }

    const bookingIdStr =
      appt.booking_id || `APT-2026-${appt.id.slice(0, 5).toUpperCase()}`;
    const tokenNum = appt.token_number || 1;
    const queuePos = appt.queue_position || 1;
    const systemUserId = '00000000-0000-0000-0000-000000000000';
    // Calculate Ticket Serial
    const { count: dailyCount } = await db
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('account_id', accountId)
      .eq('appointment_date', appt.appointment_date)
      .lte('created_at', appt.created_at || new Date().toISOString());
    const ticketSerial = `TKT-${String(dailyCount || 1).padStart(3, '0')}`;

    // 4. Generate PDF Buffer & upload to appwrite Storage `chat-media`
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      request.nextUrl.origin;
    let publicPdfUrl = `${baseUrl}/api/appointments/${appt.id}/pdf`;
    try {
      const pdfBuffer = await generatePdfBuffer(
        appt,
        hospitalName,
        patientSeqId,
        ticketSerial
      );
      const storagePath = `account-${accountId}/opd-ticket-${appt.id}.pdf`;

      const { error: uploadErr } = await db.storage
        .from('chat-media')
        .upload(storagePath, pdfBuffer, {
          contentType: 'application/pdf',
          upsert: true,
        });

      if (!uploadErr) {
        const { data: urlData } = db.storage
          .from('chat-media')
          .getPublicUrl(storagePath);
        if (urlData?.publicUrl) {
          publicPdfUrl = urlData.publicUrl;
        }
      }
    } catch (pdfGenErr) {
      console.warn('PDF generation/upload fallback:', pdfGenErr);
    }

    // 5. Formulate confirmation message
    const messageText = `✅ *OPD DOCTOR BOOKING CONFIRMED!*

Welcome to *${hospitalName}*! Your consultation ticket and token number have been issued.

📋 *TICKET TOKEN:* #${tokenNum}
📍 *Queue Position:* #${queuePos}
🎟️ *Booking ID:* ${bookingIdStr}
👨‍⚕️ *Doctor:* ${doctorName}
🏥 *Department:* ${appt.department || 'General OPD'}
📅 *Date & Time:* ${appt.appointment_date} at ${appt.appointment_time}

📄 *Your Watermarked PDF Ticket Slip is attached below.* Please present this PDF ticket or Token #${tokenNum} at reception.`;

    // 6. Send text message
    await engineSendText({
      accountId,
      userId: systemUserId,
      conversationId: conv.id,
      contactId,
      text: messageText,
    });

    // 7. Send Watermarked PDF Ticket Document via WhatsApp
    await engineSendDocument({
      accountId,
      userId: systemUserId,
      conversationId: conv.id,
      contactId,
      documentUrl: publicPdfUrl,
      filename: `opd-ticket-token-${tokenNum}-${bookingIdStr}.pdf`,
      caption: `OPD Consultation Ticket Token #${tokenNum} for ${doctorName} (${hospitalName})`,
    });

    // 8. Create a timeline note
    await db.from('contact_notes').insert({
      account_id: accountId,
      contact_id: contactId,
      user_id: null,
      content: `Sent OPD Token Ticket #${tokenNum} PDF (${bookingIdStr}) via WhatsApp.`,
    });

    return NextResponse.json({ success: true, pdfUrl: publicPdfUrl });
  } catch (err: unknown) {
    console.error('Failed to send appointment PDF ticket:', err);
    return NextResponse.json(
      { error: (err as Error).message || 'Failed to send ticket PDF' },
      { status: 500 }
    );
  }
}
