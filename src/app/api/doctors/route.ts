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

    let query = supabase
      .from('hospital_doctors')
      .select('*')
      .eq('account_id', context.accountId)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

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
      name,
      department,
      specialization,
      consultation_fee,
      working_hours,
      available_days,
      status,
      branch_id,
    } = body;

    if (!name || !department) {
      return NextResponse.json(
        { error: 'Name and Department are required' },
        { status: 400, headers: PRIVATE_HEADERS }
      );
    }

    const { data, error } = await supabase
      .from('hospital_doctors')
      .insert({
        account_id: context.accountId,
        branch_id: branch_id || null,
        name: name.trim(),
        department: department.trim(),
        specialization: specialization ? specialization.trim() : null,
        consultation_fee:
          typeof consultation_fee === 'number'
            ? consultation_fee
            : parseFloat(consultation_fee) || 0,
        working_hours: working_hours || { start: '09:00', end: '17:00' },
        available_days: Array.isArray(available_days)
          ? available_days
          : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        status: status || 'active',
      })
      .select()
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
