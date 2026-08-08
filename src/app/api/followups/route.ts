import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/account';
import { supabaseAdmin } from '@/lib/automations/admin-client';

export async function GET(request: Request) {
  try {
    const { accountId } = await requireRole('agent');
    if (!accountId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const db = supabaseAdmin();
    let query = db
      .from('hospital_followups')
      .select(
        '*, patient:contacts(id, name, phone, metadata), doctor:hospital_doctors(id, name, department)'
      )
      .eq('account_id', accountId)
      .order('due_date', { ascending: true });

    if (status && status !== 'all') {
      if (status === 'overdue') {
        const today = new Date().toISOString().split('T')[0];
        query = query.lt('due_date', today).eq('status', 'scheduled');
      } else if (status === 'today') {
        const today = new Date().toISOString().split('T')[0];
        query = query.eq('due_date', today).eq('status', 'scheduled');
      } else if (status === 'upcoming') {
        const today = new Date().toISOString().split('T')[0];
        query = query.gt('due_date', today).eq('status', 'scheduled');
      } else {
        query = query.eq('status', status);
      }
    }

    const { data: followups, error } = await query;

    if (error) {
      console.warn(
        '[Followups GET] Query error or missing table:',
        error.message
      );
      return NextResponse.json({ followups: [] });
    }

    return NextResponse.json({ followups: followups || [] });
  } catch (err: any) {
    console.error('[Followups GET] Exception:', err);
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { accountId, userId } = await requireRole('agent');
    if (!accountId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { patient_id, doctor_id, followup_type, due_date, notes } = body;

    if (!patient_id || !followup_type || !due_date) {
      return NextResponse.json(
        { error: 'patient_id, followup_type, and due_date are required' },
        { status: 400 }
      );
    }

    const db = supabaseAdmin();
    const { data: created, error } = await db
      .from('hospital_followups')
      .insert({
        account_id: accountId,
        patient_id,
        doctor_id: doctor_id || null,
        followup_type,
        due_date,
        notes: notes || null,
        status: 'scheduled',
      })
      .select(
        '*, patient:contacts(id, name, phone), doctor:hospital_doctors(id, name)'
      )
      .single();

    if (error) {
      console.error('[Followups POST] Insert error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ followup: created });
  } catch (err: any) {
    console.error('[Followups POST] Exception:', err);
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
