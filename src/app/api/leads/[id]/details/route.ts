import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/automations/admin-client';
import { AccountRole } from '@/lib/auth/roles';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: leadId } = await params;
  if (!leadId) {
    return NextResponse.json(
      { success: false, error: 'Lead ID is required.' },
      { status: 400 }
    );
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized.' },
        { status: 401 }
      );
    }

    const adminDb = supabaseAdmin();

    // 1. Fetch deal with contact and assignee
    const { data: deal, error: dealErr } = await adminDb
      .from('deals')
      .select(
        '*, contact:contacts(*), assignee:profiles!deals_assigned_to_fkey(*)'
      )
      .eq('id', leadId)
      .single();

    if (dealErr || !deal) {
      return NextResponse.json(
        { success: false, error: 'Lead not found.' },
        { status: 404 }
      );
    }

    const accountId = deal.account_id;

    // 2. Cross-tenant security check
    const { data: profile } = await adminDb
      .from('profiles')
      .select('account_id, account_role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!profile || profile.account_id !== accountId) {
      return NextResponse.json(
        { success: false, error: 'Forbidden. Cross-tenant access rejected.' },
        { status: 403 }
      );
    }

    const userRole = (profile.account_role || 'agent') as AccountRole;
    const contactId = deal.contact_id;

    // 3. Fetch related records in parallel
    const [
      consentsRes,
      appointmentsRes,
      stageHistoryRes,
      notesRes,
      callsRes,
      conversationsRes,
      followupsRes,
    ] = await Promise.all([
      contactId
        ? adminDb
            .from('communication_consents')
            .select('*')
            .eq('contact_id', contactId)
            .eq('account_id', accountId)
        : Promise.resolve({ data: [] }),
      contactId
        ? adminDb
            .from('appointments')
            .select('*')
            .eq('account_id', accountId)
            .order('appointment_date', { ascending: false })
            .limit(5)
        : Promise.resolve({ data: [] }),
      adminDb
        .from('lead_stage_history')
        .select('*')
        .eq('lead_id', leadId)
        .eq('account_id', accountId)
        .order('created_at', { ascending: false }),
      contactId
        ? adminDb
            .from('contact_notes')
            .select('*, author:profiles!contact_notes_user_id_fkey(full_name)')
            .eq('contact_id', contactId)
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [] }),
      contactId
        ? adminDb
            .from('calls')
            .select('*')
            .eq('contact_id', contactId)
            .eq('account_id', accountId)
            .order('started_at', { ascending: false })
            .limit(10)
        : Promise.resolve({ data: [] }),
      contactId
        ? adminDb
            .from('conversations')
            .select('id, status, last_message_text, last_message_at')
            .eq('contact_id', contactId)
            .single()
        : Promise.resolve({ data: null }),
      contactId
        ? adminDb
            .from('followup_enrollments')
            .select('*, sequence:followup_sequences(name)')
            .eq('contact_id', contactId)
            .eq('account_id', accountId)
        : Promise.resolve({ data: [] }),
    ]);

    let messages: unknown[] = [];
    if (conversationsRes.data?.id) {
      const { data: msgs } = await adminDb
        .from('messages')
        .select(
          'id, sender_type, content_type, content_text, status, created_at'
        )
        .eq('conversation_id', conversationsRes.data.id)
        .order('created_at', { ascending: false })
        .limit(20);
      messages = msgs || [];
    }

    return NextResponse.json({
      success: true,
      data: {
        lead: deal,
        consents: consentsRes.data || [],
        appointments: appointmentsRes.data || [],
        stageHistory: stageHistoryRes.data || [],
        notes: notesRes.data || [],
        calls: callsRes.data || [],
        conversation: conversationsRes.data || null,
        messages,
        followups: followupsRes.data || [],
        role: userRole,
      },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: (err as Error).message || 'Server error.' },
      { status: 500 }
    );
  }
}
