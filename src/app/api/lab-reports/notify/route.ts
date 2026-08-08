import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/automations/admin-client';
import {
  engineSendText,
  engineSendDocument,
} from '@/lib/automations/meta-send';

export async function POST(request: Request) {
  try {
    const { reportId, accountId } = await request.json();
    if (!reportId || !accountId) {
      return NextResponse.json(
        { error: 'Missing reportId or accountId' },
        { status: 400 }
      );
    }

    const db = supabaseAdmin();

    // Fetch report with patient contact info and doctor details
    const { data: report, error: reportErr } = await db
      .from('hospital_lab_reports')
      .select(
        '*, patient:contacts(id, name, phone), doctor:hospital_doctors(id, name)'
      )
      .eq('id', reportId)
      .single();

    if (reportErr || !report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    const patientName = report.patient?.name || 'Patient';
    const patientPhone = report.patient?.phone;
    const contactId = report.patient?.id;

    if (!patientPhone || !contactId) {
      return NextResponse.json(
        { error: 'Patient contact not found' },
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
        { error: 'Failed to find/create conversation' },
        { status: 500 }
      );
    }

    // Fetch account name
    const { data: account } = await db
      .from('accounts')
      .select('name')
      .eq('id', accountId)
      .single();

    const hospitalName = account?.name || 'Hospital';
    const docData = report.doctor as any;
    const doctorName = (
      Array.isArray(docData) ? docData[0]?.name : docData?.name
    )
      ? `Dr. ${(Array.isArray(docData) ? docData[0]?.name : docData?.name).replace(/^Dr\.\s+/i, '')}`
      : 'your doctor';
    const systemUserId = '00000000-0000-0000-0000-000000000000';

    // Formulate notification message text
    const messageText = `Hello ${patientName} 👋\n\nYour *${report.test_name}* report is now *Ready*.\n\n🏥 Hospital: ${hospitalName}\n👨‍⚕️ Referred by: ${doctorName}\n📋 Department: ${report.department || 'General'}\n📅 Date: ${new Date(report.updated_at || report.created_at).toLocaleDateString()}\n\n${report.report_pdf_url ? 'Your report PDF has been attached below.' : 'Please visit the hospital reception to collect your report.'}\n\nIf you need assistance, simply reply to this message.`;

    // 1. Send the text notification
    await engineSendText({
      accountId,
      userId: systemUserId,
      conversationId: conv.id,
      contactId,
      text: messageText,
    });

    // 2. Attach PDF if available
    if (report.report_pdf_url) {
      await engineSendDocument({
        accountId,
        userId: systemUserId,
        conversationId: conv.id,
        contactId,
        documentUrl: report.report_pdf_url,
        filename: `${report.test_name.replace(/\s+/g, '_')}_Report.pdf`,
        caption: `${report.test_name} Report PDF`,
      });
    }

    // Update notified_patient status
    await db
      .from('hospital_lab_reports')
      .update({ notified_patient: true })
      .eq('id', reportId);

    // Save note in timeline
    await db.from('contact_notes').insert({
      account_id: accountId,
      contact_id: contactId,
      note_text: `[Timeline] Report Ready Notification sent via WhatsApp for ${report.test_name}.`,
    });

    // Notify receptionist inside the inbox chat thread
    await db.from('messages').insert({
      conversation_id: conv.id,
      sender_type: 'bot',
      content_type: 'text',
      content_text: `[System Alert] WhatsApp notification sent: Report "${report.test_name}" is Ready.`,
      status: 'sent',
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[Report Notify API] Crash:', err);
    return NextResponse.json({ error: err.message || err }, { status: 500 });
  }
}
