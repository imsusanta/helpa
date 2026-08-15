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

    const date = request.nextUrl.searchParams.get('date');
    const doctorId = request.nextUrl.searchParams.get('doctorId');
    const status = request.nextUrl.searchParams.get('status');

    let query = supabase
      .from('appointments')
      .select(
        'id, booking_id, appointment_date, appointment_time, status, notes, department, token_number, queue_position, created_at, patient:contacts(id, name, phone), doctor:hospital_doctors(id, name, specialization, department)'
      )
      .eq('account_id', context.accountId)
      .order('appointment_date', { ascending: true })
      .order('appointment_time', { ascending: true });

    if (date) query = query.eq('appointment_date', date);
    if (doctorId) query = query.eq('doctor_id', doctorId);
    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500, headers: PRIVATE_HEADERS }
      );
    }

    return NextResponse.json(
      { data: data || [] },
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
      appointment_date,
      appointment_time,
      department,
      status,
      notes,
    } = body;

    if (!patient_id || !appointment_date || !appointment_time) {
      return NextResponse.json(
        { error: 'Patient, Date, and Time are required' },
        { status: 400, headers: PRIVATE_HEADERS }
      );
    }

    const { data, error } = await supabase
      .from('appointments')
      .insert({
        account_id: context.accountId,
        patient_id,
        doctor_id: doctor_id || null,
        appointment_date,
        appointment_time,
        department: department || null,
        status: status || 'pending',
        notes: notes || null,
      })
      .select(
        'id, booking_id, appointment_date, appointment_time, status, notes, department, token_number, queue_position, created_at, patient:contacts(id, name, phone), doctor:hospital_doctors(id, name, specialization, department)'
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
