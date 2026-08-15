import { NextRequest, NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { getAdminClient as getSupabaseAdminClient } from '@/lib/supabase/server';

const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store, no-cache, must-revalidate',
};

export async function GET(_request: NextRequest): Promise<NextResponse> {
  try {
    const context = await requireRole('viewer');
    const supabase = getSupabaseAdminClient();

    const { data, error } = await supabase
      .from('hospital_departments')
      .select('*')
      .eq('account_id', context.accountId)
      .order('created_at', { ascending: false });

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

    const { name, description, head_doctor_id, floor_location } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Department Name is required' },
        { status: 400, headers: PRIVATE_HEADERS }
      );
    }

    const { data, error } = await supabase
      .from('hospital_departments')
      .insert({
        account_id: context.accountId,
        name: name.trim(),
        description: description ? description.trim() : null,
        head_doctor_id: head_doctor_id || null,
        floor_location: floor_location ? floor_location.trim() : null,
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
