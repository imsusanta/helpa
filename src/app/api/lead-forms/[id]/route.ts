import { NextRequest, NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { getAdminClient as getSupabaseAdminClient } from '@/lib/supabase/server';
import { sanitizeFields } from '../route';

const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store, no-cache, must-revalidate',
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const context = await requireRole('viewer');
    const supabase = getSupabaseAdminClient();

    const { data: form, error } = await supabase
      .from('lead_forms')
      .select('*')
      .eq('id', id)
      .eq('account_id', context.accountId)
      .single();

    if (error || !form) {
      return NextResponse.json(
        { error: 'Form not found' },
        { status: 404, headers: PRIVATE_HEADERS }
      );
    }

    const { count: submissionCount } = await supabase
      .from('form_submissions')
      .select('id', { count: 'exact', head: true })
      .eq('account_id', context.accountId)
      .eq('form_id', id);

    const { count: leadCount } = await supabase
      .from('form_submissions')
      .select('id', { count: 'exact', head: true })
      .eq('account_id', context.accountId)
      .eq('form_id', id)
      .not('lead_id', 'is', null);

    return NextResponse.json(
      {
        data: {
          ...form,
          submission_count: submissionCount ?? 0,
          leads_created_count: leadCount ?? 0,
        },
      },
      { headers: PRIVATE_HEADERS }
    );
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const context = await requireRole('agent');
    const supabase = getSupabaseAdminClient();
    const body = await request.json();

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body?.name !== undefined) {
      const name =
        typeof body.name === 'string' ? body.name.trim().slice(0, 120) : '';
      if (!name) {
        return NextResponse.json(
          { error: 'Form name cannot be empty' },
          { status: 400, headers: PRIVATE_HEADERS }
        );
      }
      updatePayload.name = name;
    }
    if (body?.description !== undefined) {
      updatePayload.description =
        typeof body.description === 'string'
          ? body.description.trim().slice(0, 300) || null
          : null;
    }
    if (body?.success_message !== undefined) {
      updatePayload.success_message =
        typeof body.success_message === 'string'
          ? body.success_message.trim().slice(0, 500) || null
          : null;
    }
    if (body?.status !== undefined) {
      if (!['draft', 'active', 'paused'].includes(body.status)) {
        return NextResponse.json(
          { error: 'Invalid status' },
          { status: 400, headers: PRIVATE_HEADERS }
        );
      }
      updatePayload.status = body.status;
    }
    if (body?.fields !== undefined) {
      const fields = sanitizeFields(body.fields);
      if (!fields) {
        return NextResponse.json(
          {
            error:
              'Fields are invalid — at minimum Name and Phone are required',
          },
          { status: 400, headers: PRIVATE_HEADERS }
        );
      }
      updatePayload.fields = fields;
    }

    const { data, error } = await supabase
      .from('lead_forms')
      .update(updatePayload)
      .eq('id', id)
      .eq('account_id', context.accountId)
      .select()
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? 'Form not found' },
        { status: error ? 500 : 404, headers: PRIVATE_HEADERS }
      );
    }

    return NextResponse.json({ data }, { headers: PRIVATE_HEADERS });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const context = await requireRole('admin');
    const supabase = getSupabaseAdminClient();

    const { error } = await supabase
      .from('lead_forms')
      .delete()
      .eq('id', id)
      .eq('account_id', context.accountId);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500, headers: PRIVATE_HEADERS }
      );
    }

    return NextResponse.json({ success: true }, { headers: PRIVATE_HEADERS });
  } catch (err) {
    return toErrorResponse(err);
  }
}
