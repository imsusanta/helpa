import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/account';
import { getAdminClient } from '@/lib/db/server';

export async function GET(request: Request) {
  try {
    const { accountId } = await requireRole('agent');
    if (!accountId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const contactId =
      searchParams.get('contact_id') || searchParams.get('patient_id');

    const db = getAdminClient();
    let query = db
      .from('hospital_followups')
      .select(
        '*, patient:contacts(id, name, phone, metadata), doctor:hospital_doctors(id, name, department)'
      )
      .eq('account_id', accountId)
      .order('due_date', { ascending: true });

    if (contactId) {
      query = query.eq('patient_id', contactId);
    }

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
  } catch (err: unknown) {
    console.error('[Followups GET] Exception:', err);
    return NextResponse.json(
      { error: (err as Error).message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { accountId, userId: _userId } = await requireRole('agent');
    if (!accountId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      patient_id,
      contact_id,
      doctor_id,
      assigned_user_id,
      followup_type,
      title,
      due_date,
      notes,
    } = body;
    const targetContactId = patient_id || contact_id;
    const taskType = followup_type || title || 'Follow-up Task';

    if (!targetContactId || !due_date) {
      return NextResponse.json(
        { error: 'Contact ID and due_date are required' },
        { status: 400 }
      );
    }

    const db = getAdminClient();
    const { data: tenantContact } = await db
      .from('contacts')
      .select('id')
      .eq('id', targetContactId)
      .eq('account_id', accountId)
      .maybeSingle();

    if (!tenantContact) {
      return NextResponse.json(
        { error: 'Contact not found.' },
        { status: 404 }
      );
    }
    const insertPayload: Record<string, unknown> = {
      account_id: accountId,
      patient_id: targetContactId,
      doctor_id: doctor_id || assigned_user_id || null,
      assigned_user_id: assigned_user_id || doctor_id || null,
      followup_type: taskType,
      due_date,
      notes: notes || null,
      status: 'scheduled',
    };

    let { data: created, error } = await db
      .from('hospital_followups')
      .insert(insertPayload)
      .select(
        '*, patient:contacts(id, name, phone), doctor:hospital_doctors(id, name)'
      )
      .single();

    if (error && error.message?.includes('assigned_user_id')) {
      delete insertPayload.assigned_user_id;
      const retry = await db
        .from('hospital_followups')
        .insert(insertPayload)
        .select(
          '*, patient:contacts(id, name, phone), doctor:hospital_doctors(id, name)'
        )
        .single();
      created = retry.data;
      error = retry.error;
    }

    if (error) {
      console.error('[Followups POST] Insert error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ followup: created });
  } catch (err: unknown) {
    console.error('[Followups POST] Exception:', err);
    return NextResponse.json(
      { error: (err as Error).message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const { accountId } = await requireRole('agent');
    if (!accountId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, status, due_date, notes, assigned_user_id, title } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Task ID is required' },
        { status: 400 }
      );
    }

    const updatePayload: Record<string, unknown> = {};
    if (status !== undefined) updatePayload.status = status;
    if (due_date !== undefined) updatePayload.due_date = due_date;
    if (notes !== undefined) updatePayload.notes = notes;
    if (assigned_user_id !== undefined)
      updatePayload.assigned_user_id = assigned_user_id;
    if (title !== undefined) updatePayload.followup_type = title;

    const db = getAdminClient();
    let { data: updated, error } = await db
      .from('hospital_followups')
      .update(updatePayload)
      .eq('id', id)
      .eq('account_id', accountId)
      .select()
      .single();

    if (error && error.message?.includes('assigned_user_id')) {
      delete updatePayload.assigned_user_id;
      const retry = await db
        .from('hospital_followups')
        .update(updatePayload)
        .eq('id', id)
        .eq('account_id', accountId)
        .select()
        .single();
      updated = retry.data;
      error = retry.error;
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ followup: updated });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: (err as Error).message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { accountId } = await requireRole('agent');
    if (!accountId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Task ID is required' },
        { status: 400 }
      );
    }

    const db = getAdminClient();
    const { error } = await db
      .from('hospital_followups')
      .delete()
      .eq('id', id)
      .eq('account_id', accountId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: (err as Error).message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
