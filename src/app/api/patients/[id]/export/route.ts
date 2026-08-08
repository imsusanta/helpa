import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/automations/admin-client';
import {
  exportPatientData,
  PatientConsentRecord,
} from '@/lib/privacy/consent-service';

export async function GET(
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
        { error: 'Missing account_id parameter' },
        {
          status: 400,
          headers: {
            'Cache-Control': 'private, no-store, no-cache, must-revalidate',
          },
        }
      );
    }

    const db = supabaseAdmin();

    // 1. Fetch patient record securely scoped by account_id
    const { data: patient, error: fetchErr } = await db
      .from('patients')
      .select('*')
      .eq('id', id)
      .eq('account_id', account_id)
      .maybeSingle();

    if (fetchErr || !patient) {
      return NextResponse.json(
        { error: 'Patient record not found or cross-tenant access denied' },
        {
          status: 404,
          headers: {
            'Cache-Control': 'private, no-store, no-cache, must-revalidate',
          },
        }
      );
    }

    const consentRecord: PatientConsentRecord = {
      id: patient.id,
      account_id: patient.account_id,
      phone: patient.phone,
      name: patient.name,
      email: patient.email,
      consent_status:
        (patient.consent_status as 'opted_in' | 'opted_out') || 'opted_in',
      consent_updated_at:
        patient.consent_updated_at || new Date().toISOString(),
    };

    const exportedData = exportPatientData(consentRecord);

    // 2. Create append-only audit event for sensitive patient data export
    await db.from('audit_logs').insert({
      account_id,
      actor_id: actor_id || null,
      action: 'patient.data_exported',
      resource_type: 'patients',
      resource_id: id,
      metadata: { exported_at: exportedData.exported_at },
    });

    return NextResponse.json(exportedData, {
      headers: {
        'Cache-Control': 'private, no-store, no-cache, must-revalidate',
      },
    });
  } catch (err: unknown) {
    console.error('[Patient Export API] Error:', err);
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
