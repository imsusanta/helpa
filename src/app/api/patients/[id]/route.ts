import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/automations/admin-client';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const account_id = searchParams.get('account_id');
    const actor_id = searchParams.get('actor_id');

    if (!account_id) {
      return NextResponse.json(
        { error: 'Missing required parameter: account_id' },
        {
          status: 400,
          headers: {
            'Cache-Control': 'private, no-store, no-cache, must-revalidate',
          },
        }
      );
    }

    const db = supabaseAdmin();

    // 1. Verify patient ownership and tenant boundary before deletion
    const { data: patient, error: fetchErr } = await db
      .from('patients')
      .select('id, account_id, name, phone')
      .eq('id', id)
      .eq('account_id', account_id)
      .maybeSingle();

    if (fetchErr || !patient) {
      return NextResponse.json(
        { error: 'Patient not found or cross-tenant deletion denied' },
        {
          status: 404,
          headers: {
            'Cache-Control': 'private, no-store, no-cache, must-revalidate',
          },
        }
      );
    }

    // 2. Execute deletion securely scoped by account_id and patient id
    const { error: deleteErr } = await db
      .from('patients')
      .delete()
      .eq('id', id)
      .eq('account_id', account_id);

    if (deleteErr) {
      console.error('[Patient Delete API] Failed to delete patient:', deleteErr);
      return NextResponse.json(
        { error: 'Failed to delete patient record' },
        {
          status: 500,
          headers: {
            'Cache-Control': 'private, no-store, no-cache, must-revalidate',
          },
        }
      );
    }

    // 3. Create immutable audit log event
    await db.from('audit_logs').insert({
      account_id,
      actor_id: actor_id || null,
      action: 'patient.data_deleted',
      resource_type: 'patients',
      resource_id: id,
      metadata: {
        deleted_patient_id: id,
        deleted_at: new Date().toISOString(),
      },
    });

    return NextResponse.json(
      { success: true, message: 'Patient data deleted successfully' },
      {
        headers: {
          'Cache-Control': 'private, no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (err: unknown) {
    console.error('[Patient Delete API] Error:', err);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      {
        status: 500,
        headers: {
          'Cache-Control': 'private, no-store, no-cache, must-revalidate',
        },
      }
    );
  }
}
