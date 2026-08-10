import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/account';
import { appwriteAdmin } from '@/lib/appwrite-compat';
import {
  engineSendDocument,
  engineSendText as _engineSendText,
} from '@/lib/automations/meta-send';

export async function POST(request: Request) {
  try {
    const { accountId, userId } = await requireRole('agent');
    if (!accountId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      contact_id,
      doc_type = 'lab_report',
      test_name,
      department = 'Pathology',
      report_pdf_url,
      auto_send = true,
      notes,
    } = body;

    if (!contact_id || !test_name || !report_pdf_url) {
      return NextResponse.json(
        { error: 'contact_id, test_name, and report_pdf_url are required' },
        { status: 400 }
      );
    }

    const db = appwriteAdmin();

    // Fetch contact details
    const { data: contact, error: contactErr } = await db
      .from('contacts')
      .select('id, name, phone, metadata')
      .eq('id', contact_id)
      .eq('account_id', accountId)
      .single();

    if (contactErr || !contact) {
      return NextResponse.json(
        { error: 'Patient contact record not found' },
        { status: 404 }
      );
    }

    const patientName = contact.name || 'Patient';
    const patientSeqId = contact.metadata?.patient_id || 'PAT-000000';

    // Fetch account details for business name
    const { data: acc } = await db
      .from('accounts')
      .select('name')
      .eq('id', accountId)
      .single();
    const clinicName = acc?.name || 'Helpa Health Clinic';

    // Insert record into hospital_lab_reports
    const { data: report, error: reportErr } = await db
      .from('hospital_lab_reports')
      .insert({
        account_id: accountId,
        patient_id: contact_id,
        test_name,
        department,
        status: 'ready',
        report_pdf_url,
        notes: notes || null,
        notified_patient: auto_send,
      })
      .select()
      .single();

    if (reportErr) {
      console.error('[Upload Patient PDF] Insert error:', reportErr);
    }

    // Auto-detect & save Blood Group from report text if present
    const combinedText = `${test_name} ${notes || ''}`;
    const bgMatch =
      combinedText.match(/\b(A\+|A\-|B\+|B\-|AB\+|AB\-|O\+|O\-)\b/i) ||
      combinedText.match(/\b(A|B|AB|O)\s+(positive|negative|pos|neg)\b/i);

    if (bgMatch) {
      const detectedBg = bgMatch[0]
        .toUpperCase()
        .replace(/\s+POS(ITIVE)?/i, '+')
        .replace(/\s+NEG(ATIVE)?/i, '-');
      if (detectedBg) {
        await db
          .from('patients')
          .update({ blood_group: detectedBg })
          .eq('id', contact_id);
        const meta = contact.metadata || {};
        await db
          .from('contacts')
          .update({ metadata: { ...meta, blood_group: detectedBg } })
          .eq('id', contact_id);
      }
    }

    // Auto-send via WhatsApp if enabled
    if (auto_send) {
      // Find or resolve conversation
      let { data: conv } = await db
        .from('conversations')
        .select('id')
        .eq('account_id', accountId)
        .eq('contact_id', contact_id)
        .maybeSingle();

      if (!conv) {
        const { data: newConv } = await db
          .from('conversations')
          .insert({
            account_id: accountId,
            user_id: userId,
            contact_id,
            status: 'open',
            last_message_text: `Delivered ${test_name} document PDF`,
            last_message_at: new Date().toISOString(),
          })
          .select('id')
          .single();

        conv = newConv;
      }

      if (conv) {
        const captionMsg = `📄 Hello *${patientName}*,\n\nYour *${test_name}* (${doc_type.replace('_', ' ').toUpperCase()}) from *${clinicName}* is ready! Please find your document attached below.\n\n🏥 *${clinicName}*`;

        // Send PDF document via Meta WhatsApp Cloud API
        await engineSendDocument({
          accountId,
          userId: userId || 'system',
          conversationId: conv.id,
          contactId: contact_id,
          documentUrl: report_pdf_url,
          filename: `${test_name.replace(/\s+/g, '_')}_${patientSeqId}.pdf`,
          caption: captionMsg,
        }).catch((err) =>
          console.error('[Upload Patient PDF] engineSendDocument error:', err)
        );
      }
    }

    // Log event in contact_notes timeline
    await db.from('contact_notes').insert({
      account_id: accountId,
      contact_id,
      user_id: userId || null,
      content: `📄 Uploaded ${doc_type.replace('_', ' ')}: ${test_name} (${auto_send ? 'Dispatched to WhatsApp' : 'Saved to profile'})`,
    });

    return NextResponse.json({
      success: true,
      report,
      message: 'PDF uploaded and recorded successfully',
    });
  } catch (err: unknown) {
    console.error('[Upload Patient PDF] Exception:', err);
    return NextResponse.json(
      { error: (err as Error).message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
