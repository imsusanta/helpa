import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/account';
import { getAdminClient } from '@/lib/db/server';
import { engineSendText } from '@/lib/automations/meta-send';

export async function POST(request: Request) {
  try {
    const { accountId, userId } = await requireRole('agent');
    if (!accountId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { followupId } = await request.json();
    if (!followupId) {
      return NextResponse.json(
        { error: 'followupId is required' },
        { status: 400 }
      );
    }

    const db = getAdminClient();

    // Fetch account details for business name
    const { data: acc } = await db
      .from('accounts')
      .select('name')
      .eq('id', accountId)
      .single();
    const clinicName = acc?.name || 'Helpa Health Clinic';

    // Fetch follow-up record — scoped to the caller's tenant so a
    // guessed followupId can never read or message another clinic's
    // patient.
    const { data: followup, error: fetchErr } = await db
      .from('hospital_followups')
      .select(
        '*, patient:contacts(id, name, phone), doctor:hospital_doctors(id, name)'
      )
      .eq('id', followupId)
      .eq('account_id', accountId)
      .single();

    if (fetchErr || !followup || !followup.patient) {
      return NextResponse.json(
        { error: 'Follow-up or patient record not found' },
        { status: 404 }
      );
    }

    const patientName = followup.patient.name || 'Patient';
    const _patientPhone = followup.patient.phone;
    const docData = followup.doctor as
      { name?: string } | { name?: string }[] | null;
    const docName =
      (Array.isArray(docData) ? docData[0]?.name : docData?.name) ||
      'your doctor';

    // Find or create conversation
    let { data: conv } = await db
      .from('conversations')
      .select('id')
      .eq('account_id', accountId)
      .eq('contact_id', followup.patient.id)
      .maybeSingle();

    if (!conv) {
      const { data: newConv } = await db
        .from('conversations')
        .insert({
          account_id: accountId,
          contact_id: followup.patient.id,
          status: 'open',
          last_message_text: `Follow-up reminder sent for ${followup.followup_type}`,
          last_message_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      conv = newConv;
    }

    if (!conv) {
      return NextResponse.json(
        { error: 'Failed to resolve conversation' },
        { status: 500 }
      );
    }

    // Build personalized WhatsApp reminder message
    const reminderMsg = `👋 Hello *${patientName}*,\n\nThis is a friendly reminder from *${clinicName}* for your upcoming *${followup.followup_type}* follow-up review with *Dr. ${docName}* scheduled for *${followup.due_date}*.\n\n📅 Regular follow-ups ensure your recovery and health remain on track!\n\nWould you like to confirm your appointment or adjust your timing? Reply directly to this message or reply *BOOK* to consult with our AI Assistant 24/7.\n\n🏥 *${clinicName}*`;

    // Dispatch WhatsApp message
    await engineSendText({
      accountId,
      userId: userId || 'system',
      conversationId: conv.id,
      contactId: followup.patient.id,
      text: reminderMsg,
    });

    // Update follow-up status
    await db
      .from('hospital_followups')
      .update({
        status: 'reminder_sent',
        last_reminder_sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', followupId)
      .eq('account_id', accountId);

    // Create note in timeline
    try {
      await db.from('contact_notes').insert({
        account_id: accountId,
        contact_id: followup.patient.id,
        note_text: `📅 WhatsApp Follow-up Reminder sent for ${followup.followup_type} (Due: ${followup.due_date})`,
      });
    } catch {
      // non-blocking
    }

    return NextResponse.json({
      success: true,
      message: 'Follow-up reminder dispatched successfully',
    });
  } catch (err: unknown) {
    console.error('[Followups Remind POST] Exception:', err);
    return NextResponse.json(
      { error: (err as Error).message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
