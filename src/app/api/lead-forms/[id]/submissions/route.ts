import { NextRequest, NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { getAdminClient as getSupabaseAdminClient } from '@/lib/supabase/server';

const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store, no-cache, must-revalidate',
};

const SUBMISSION_STATUSES = ['new', 'contacted', 'converted', 'archived'];

/**
 * Lists submissions for one tenant-owned form. Contact rows are joined
 * for the table view; raw IPs are never exposed (only a salted hash is
 * stored for abuse forensics and it is not selected here).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const context = await requireRole('viewer');
    const supabase = getSupabaseAdminClient();
    const { searchParams } = request.nextUrl;

    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get('limit') || '50', 10))
    );
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10));

    // Verify the form belongs to this tenant first.
    const { data: form, error: formError } = await supabase
      .from('lead_forms')
      .select('id, name')
      .eq('id', id)
      .eq('account_id', context.accountId)
      .single();

    if (formError || !form) {
      return NextResponse.json(
        { error: 'Form not found' },
        { status: 404, headers: PRIVATE_HEADERS }
      );
    }

    const {
      data: submissions,
      count,
      error,
    } = await supabase
      .from('form_submissions')
      .select('*, contact:contacts(id, name, phone)', { count: 'exact' })
      .eq('account_id', context.accountId)
      .eq('form_id', id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500, headers: PRIVATE_HEADERS }
      );
    }

    return NextResponse.json(
      {
        data: {
          form_name: form.name,
          submissions: submissions ?? [],
          total: count ?? 0,
          limit,
          offset,
        },
      },
      { headers: PRIVATE_HEADERS }
    );
  } catch (err) {
    return toErrorResponse(err);
  }
}

/**
 * Updates a single submission: triage status and/or assignment.
 * Body: { submission_id, status?, assigned_user_id? }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const context = await requireRole('agent');
    const supabase = getSupabaseAdminClient();
    const body = await request.json();

    const submissionId =
      typeof body?.submission_id === 'string' ? body.submission_id : '';
    if (!submissionId) {
      return NextResponse.json(
        { error: 'submission_id is required' },
        { status: 400, headers: PRIVATE_HEADERS }
      );
    }

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body?.status !== undefined) {
      if (!SUBMISSION_STATUSES.includes(body.status)) {
        return NextResponse.json(
          { error: 'Invalid submission status' },
          { status: 400, headers: PRIVATE_HEADERS }
        );
      }
      updatePayload.status = body.status;
    }

    if (body?.assigned_user_id !== undefined) {
      updatePayload.assigned_user_id =
        typeof body.assigned_user_id === 'string' &&
        body.assigned_user_id.trim()
          ? body.assigned_user_id.trim()
          : null;
    }

    // Tenant-scoped via both account_id and the parent form id.
    const { data, error } = await supabase
      .from('form_submissions')
      .update(updatePayload)
      .eq('id', submissionId)
      .eq('form_id', id)
      .eq('account_id', context.accountId)
      .select()
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? 'Submission not found' },
        { status: error ? 500 : 404, headers: PRIVATE_HEADERS }
      );
    }

    return NextResponse.json({ data }, { headers: PRIVATE_HEADERS });
  } catch (err) {
    return toErrorResponse(err);
  }
}
