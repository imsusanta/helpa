import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/automations/admin-client';
import {
  withdrawPatientConsent,
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
      reason?: string;
      actor_id?: string;
    };

    const { account_id, reason = 'patient_opted_out', actor_id } = body;

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

    // 1. Fetch current patient record securely scoped by account_id
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

    const updatedConsent = withdrawPatientConsent(consentRecord);

    // 2. Update database record to opted_out
    const { error: updateErr } = await db
      .from('patients')
      .update({
        consent_status: 'opted_out',
        consent_source: 'optout_request',
        consent_updated_at: updatedConsent.consent_updated_at,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('account_id', account_id);

    if (updateErr) {
      console.error(
        '[Withdrawal API] Failed to withdraw patient consent:',
        updateErr
      );
      return NextResponse.json(
        { error: 'Failed to record consent withdrawal' },
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
      action: 'patient.consent_withdrawn',
      resource_type: 'patients',
      resource_id: id,
      metadata: {
        previous_status: patient.consent_status,
        new_status: 'opted_out',
        reason,
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
    console.error('[Withdrawal API] Internal error:', err);
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
