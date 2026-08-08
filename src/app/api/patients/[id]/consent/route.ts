import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/automations/admin-client';
import {
  recordPatientConsent,
  PatientConsentRecord,
} from '@/lib/privacy/consent-service';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as {
      account_id?: string;
      consent_status?: 'opted_in' | 'opted_out';
      consent_source?: string;
      actor_id?: string;
    };

    const {
      account_id,
      consent_status,
      consent_source = 'web_dashboard',
      actor_id,
    } = body;

    if (
      !account_id ||
      !consent_status ||
      !['opted_in', 'opted_out'].includes(consent_status)
    ) {
      return NextResponse.json(
        {
          error:
            'Missing required parameters: account_id and valid consent_status',
        },
        {
          status: 400,
          headers: {
            'Cache-Control': 'private, no-store, no-cache, must-revalidate',
          },
        }
      );
    }

    const db = supabaseAdmin();

    // 1. Fetch current patient record
    const { data: patient, error: fetchErr } = await db
      .from('patients')
      .select('*')
      .eq('id', id)
      .eq('account_id', account_id)
      .maybeSingle();

    if (fetchErr || !patient) {
      return NextResponse.json(
        { error: 'Patient not found or cross-tenant access denied' },
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

    const updatedConsent = recordPatientConsent(consentRecord, consent_status);

    // 2. Update database record
    const { error: updateErr } = await db
      .from('patients')
      .update({
        consent_status: updatedConsent.consent_status,
        consent_source,
        consent_updated_at: updatedConsent.consent_updated_at,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('account_id', account_id);

    if (updateErr) {
      console.error(
        '[Consent API] Failed to update patient consent:',
        updateErr
      );
      return NextResponse.json(
        { error: 'Failed to update consent record' },
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
      action: 'patient.consent_updated',
      resource_type: 'patients',
      resource_id: id,
      metadata: {
        previous_status: patient.consent_status,
        new_status: updatedConsent.consent_status,
        source: consent_source,
      },
    });

    return NextResponse.json(
      { success: true, consent: updatedConsent },
      {
        headers: {
          'Cache-Control': 'private, no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (err: unknown) {
    console.error('[Consent API] Internal error:', err);
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
