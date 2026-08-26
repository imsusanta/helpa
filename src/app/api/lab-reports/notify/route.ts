import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/db/server';
import { requireRole } from '@/lib/auth/account';
import {
  engineSendText,
  engineSendDocument,
} from '@/lib/automations/meta-send';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { reportId, accountId: bodyAccountId } = body;

    const authContext = await requireRole('agent').catch(() => null);
    const accountId = authContext?.accountId || bodyAccountId;

    if (!reportId || !accountId) {
      return NextResponse.json(
        { error: 'Missing reportId or accountId' },
        { status: 400 }
      );
    }

    const db = getAdminClient();

    // 1. Fetch report details
    const { data: report, error: reportErr } = await db
      .from('hospital_lab_reports')
      .select('*')
      .eq('id', reportId)
      .eq('account_id', accountId)
      .maybeSingle();

    if (reportErr || !report) {
      return NextResponse.json(
        { error: 'Lab report record not found.' },
        { status: 404 }
      );
    }

    // 2. Resolve Contact and Patient Info
    let contactId = report.patient_id;
    let patientName = 'Patient';
    let patientPhone = '';

    // Direct contact lookup
    if (contactId) {
      try {
        const { data: directContact } = await db
          .from('contacts')
          .select('id, name, phone')
          .eq('id', contactId)
          .maybeSingle();

        if (directContact) {
          patientName = directContact.name || 'Patient';
          patientPhone = directContact.phone || '';
          contactId = directContact.id;
        }
      } catch {
        // continue to patient fallback
      }
    }

    // Fallback: check if patient_id refers to patients table
    if (!patientPhone && report.patient_id) {
      try {
        const { data: patRec } = await db
          .from('patients')
          .select(
            'id, contact_id, patient_seq_id, contact:contacts(id, name, phone)'
          )
          .or(
            `id.eq.${report.patient_id},patient_seq_id.eq.${report.patient_id}`
          )
          .maybeSingle();

        // PostgREST types embedded relations as arrays until generated
        // schema types land; at runtime a to-one join returns an object.
        const linked = patRec?.contact as unknown as {
          id: string;
          name?: string;
          phone?: string;
        } | null;
        if (linked) {
          patientName = linked.name || 'Patient';
          patientPhone = linked.phone || '';
          contactId = linked.id;
        } else if (patRec?.contact_id) {
          const { data: cById } = await db
            .from('contacts')
            .select('id, name, phone')
            .eq('id', patRec.contact_id)
            .maybeSingle();
          if (cById) {
            patientName = cById.name || 'Patient';
            patientPhone = cById.phone || '';
            contactId = cById.id;
          }
        }
      } catch {
        // ignore
      }
    }

    if (!contactId || !patientPhone) {
      return NextResponse.json(
        {
          error:
            'Patient contact phone number not found. Please attach a valid contact with a phone number to this report.',
        },
        { status: 404 }
      );
    }

    // 3. Find or create conversation
    let convId = '';
    const { data: existingConv } = await db
      .from('conversations')
      .select('id')
      .eq('contact_id', contactId)
      .eq('account_id', accountId)
      .maybeSingle();

    if (existingConv?.id) {
      convId = existingConv.id;
    } else {
      const { data: accountData } = await db
        .from('accounts')
        .select('owner_user_id')
        .eq('id', accountId)
        .maybeSingle();

      const ownerUserId =
        accountData?.owner_user_id ||
        authContext?.userId ||
        '00000000-0000-0000-0000-000000000000';

      const { data: newConv } = await db
        .from('conversations')
        .insert({
          account_id: accountId,
          contact_id: contactId,
          user_id: ownerUserId,
          status: 'open',
          unread_count: 0,
        })
        .select('id')
        .maybeSingle();

      if (newConv?.id) {
        convId = newConv.id;
      }
    }

    // 4. Fetch Doctor and Account details
    let doctorName = 'your doctor';
    if (report.doctor_id) {
      try {
        const { data: doc } = await db
          .from('hospital_doctors')
          .select('name')
          .eq('id', report.doctor_id)
          .maybeSingle();
        if (doc?.name) {
          doctorName = `Dr. ${doc.name.replace(/^Dr\.\s+/i, '')}`;
        }
      } catch {
        // ignore
      }
    }

    const { data: account } = await db
      .from('accounts')
      .select('name')
      .eq('id', accountId)
      .maybeSingle();

    const hospitalName = account?.name || 'Helpa Health';
    const systemUserId = authContext?.userId || 'system';

    // 5. Send notification text message
    const messageText = `Hello ${patientName} 👋\n\nYour *${report.test_name}* report is now *Ready*.\n\n🏥 Clinic: ${hospitalName}\n👨‍⚕️ Referred by: ${doctorName}\n📋 Department: ${report.department || 'General'}\n📅 Date: ${new Date(report.updated_at || report.created_at).toLocaleDateString()}\n\n${report.report_pdf_url ? 'Your report PDF has been attached below.' : 'Please visit the clinic reception to collect your physical report copy.'}\n\nIf you have any questions or would like to book a follow-up consultation, feel free to reply directly to this message.`;

    await engineSendText({
      accountId,
      userId: systemUserId,
      conversationId: convId,
      contactId,
      text: messageText,
    });

    // 6. Attach PDF if available
    if (report.report_pdf_url) {
      await engineSendDocument({
        accountId,
        userId: systemUserId,
        conversationId: convId,
        contactId,
        documentUrl: report.report_pdf_url,
        filename: `${report.test_name.replace(/\s+/g, '_')}_Report.pdf`,
        caption: `Here is your completed ${report.test_name} report.`,
        deliveryIntent: 'staff_initiated',
      });
    }

    // 7. Update notified_patient status
    await db
      .from('hospital_lab_reports')
      .update({
        notified_patient: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', reportId);

    // 8. Save note in timeline
    try {
      await db.from('contact_notes').insert({
        account_id: accountId,
        contact_id: contactId,
        note_text: `[Timeline] Report Ready Notification sent via WhatsApp for ${report.test_name}.`,
      });
    } catch {
      // ignore
    }

    return NextResponse.json({
      success: true,
      message: 'Patient notified on WhatsApp successfully',
    });
  } catch (err: unknown) {
    console.error('[Report Notify API] Crash:', err);
    return NextResponse.json(
      { error: (err as Error).message || String(err) },
      { status: 500 }
    );
  }
}
