import { NextRequest, NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { getAdminClient as getSupabaseAdminClient } from '@/lib/supabase/server';

const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store, no-cache, must-revalidate',
};

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const context = await requireRole('viewer');
    const supabase = getSupabaseAdminClient();

    const status = request.nextUrl.searchParams.get('status');
    const patientId = request.nextUrl.searchParams.get('patientId');

    let query = supabase
      .from('hospital_lab_reports')
      .select(
        '*, patient:contacts(id, name, phone), doctor:hospital_doctors(id, name, department)'
      )
      .eq('account_id', context.accountId)
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);
    if (patientId) query = query.eq('patient_id', patientId);

    const { data, error } = await query;
    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500, headers: PRIVATE_HEADERS }
      );
    }

    const reports = data || [];
    const missingPatientIds = reports
      .filter((r) => !r.patient && r.patient_id)
      .map((r) => r.patient_id as string);

    if (missingPatientIds.length > 0) {
      const { data: directContacts } = await supabase
        .from('contacts')
        .select('id, name, phone')
        .in('id', missingPatientIds);

      const contactMap = new Map((directContacts || []).map((c) => [c.id, c]));

      for (const r of reports) {
        if (!r.patient && r.patient_id && contactMap.has(r.patient_id)) {
          r.patient = contactMap.get(r.patient_id);
        }
      }
    }

    return NextResponse.json(
      { data: reports },
      { headers: PRIVATE_HEADERS }
    );
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const context = await requireRole('agent');
    const supabase = getSupabaseAdminClient();
    const body = await request.json();

    const {
      patient_id,
      doctor_id,
      test_name,
      department,
      status,
      expected_delivery_date,
      report_pdf_url,
      result_url,
      notes,
      internal_notes,
    } = body;

    if (!patient_id || !test_name) {
      return NextResponse.json(
        { error: 'Patient and Test Name are required' },
        { status: 400, headers: PRIVATE_HEADERS }
      );
    }

    const { data, error } = await supabase
      .from('hospital_lab_reports')
      .insert({
        account_id: context.accountId,
        patient_id,
        doctor_id: doctor_id || null,
        test_name: test_name.trim(),
        department: department || null,
        status: status || 'pending',
        expected_delivery_date: expected_delivery_date || null,
        report_pdf_url: report_pdf_url || null,
        result_url: result_url || null,
        notes: notes || null,
        internal_notes: internal_notes || null,
      })
      .select(
        '*, patient:contacts(id, name, phone), doctor:hospital_doctors(id, name, department)'
      )
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500, headers: PRIVATE_HEADERS }
      );
    }

    return NextResponse.json(
      { data },
      { status: 201, headers: PRIVATE_HEADERS }
    );
  } catch (err) {
    return toErrorResponse(err);
  }
}
