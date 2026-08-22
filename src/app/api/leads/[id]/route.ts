import { NextRequest, NextResponse } from 'next/server';
import {
  ForbiddenError,
  UnauthorizedError,
  requireRole,
} from '@/lib/auth/account';
import { getAdminClient as getSupabaseAdminClient } from '@/lib/supabase/server';

const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store, no-cache, must-revalidate',
};

function requestId(request: NextRequest): string {
  return request.headers.get('x-request-id') ?? crypto.randomUUID();
}

function errorResponse(
  status: number,
  code: string,
  correlationId: string,
  message?: string
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: code,
      message: message || code,
      requestId: correlationId,
    },
    { status, headers: { ...PRIVATE_HEADERS, 'X-Request-Id': correlationId } }
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const correlationId = requestId(request);
  try {
    const { id } = await params;
    if (!id) return errorResponse(400, 'INVALID_LEAD_ID', correlationId);

    const ctx = await requireRole('viewer');
    const supabase = getSupabaseAdminClient();

    const { data: lead, error } = await supabase
      .from('leads')
      .select('*, contacts(*)')
      .eq('id', id)
      .eq('account_id', ctx.accountId)
      .maybeSingle();

    if (error || !lead) {
      return errorResponse(
        404,
        'LEAD_NOT_FOUND',
        correlationId,
        'Lead not found.'
      );
    }

    return NextResponse.json(
      { success: true, data: lead, requestId: correlationId },
      { headers: { ...PRIVATE_HEADERS, 'X-Request-Id': correlationId } }
    );
  } catch (err: unknown) {
    if (err instanceof UnauthorizedError) {
      return errorResponse(401, 'AUTH_REQUIRED', correlationId);
    }
    if (err instanceof ForbiddenError) {
      return errorResponse(403, 'ACCOUNT_MEMBERSHIP_REQUIRED', correlationId);
    }
    return errorResponse(500, 'LEAD_FETCH_FAILED', correlationId);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const correlationId = requestId(request);
  try {
    const { id } = await params;
    if (!id) return errorResponse(400, 'INVALID_LEAD_ID', correlationId);

    const ctx = await requireRole('agent');
    const supabase = getSupabaseAdminClient();
    const body = await request.json();

    // Check if lead exists in this tenant
    const { data: existingLead } = await supabase
      .from('leads')
      .select('*')
      .eq('id', id)
      .eq('account_id', ctx.accountId)
      .maybeSingle();

    if (!existingLead) {
      return errorResponse(
        404,
        'LEAD_NOT_FOUND',
        correlationId,
        'Lead not found.'
      );
    }

    const {
      name,
      phone,
      email,
      service,
      source,
      channel,
      score,
      lead_score,
      value,
      currency,
      assigned_user_id,
      notes,
      attention_required,
      next_follow_up_at,
      metadata,
    } = body;

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (name !== undefined) updates.name = String(name).trim();
    if (phone !== undefined)
      updates.phone = phone ? String(phone).replace(/[^\d+]/g, '') : null;
    if (email !== undefined)
      updates.email = email ? String(email).trim().toLowerCase() : null;
    if (service !== undefined) updates.service = String(service).trim();
    if (source !== undefined) updates.source = String(source);
    if (channel !== undefined) updates.channel = String(channel);
    if (score !== undefined) updates.score = String(score).toLowerCase();
    if (lead_score !== undefined) updates.lead_score = String(lead_score);
    if (value !== undefined) updates.value = Number(value) || 0;
    if (currency !== undefined)
      updates.currency = String(currency).toUpperCase();
    if (assigned_user_id !== undefined)
      updates.assigned_user_id = assigned_user_id || null;
    if (notes !== undefined)
      updates.notes = notes ? String(notes).trim() : null;
    if (attention_required !== undefined)
      updates.attention_required = Boolean(attention_required);
    if (next_follow_up_at !== undefined)
      updates.next_follow_up_at = next_follow_up_at;
    if (metadata !== undefined) updates.metadata = metadata;

    const { data: updatedLead, error: updateError } = await supabase
      .from('leads')
      .update(updates)
      .eq('id', id)
      .eq('account_id', ctx.accountId)
      .select('*, contacts(*)')
      .single();

    if (updateError || !updatedLead) {
      console.error('[leads] PUT update error:', updateError);
      return errorResponse(
        500,
        'LEAD_UPDATE_FAILED',
        correlationId,
        updateError?.message
      );
    }

    // If assignee changed, log activity
    if (
      assigned_user_id !== undefined &&
      assigned_user_id !== existingLead.assigned_user_id
    ) {
      await supabase.from('lead_activities').insert({
        account_id: ctx.accountId,
        lead_id: id,
        actor_user_id: ctx.userId,
        activity_type: 'assigned',
        notes: `Assigned to user ${assigned_user_id || 'unassigned'}`,
      });
    }

    return NextResponse.json(
      { success: true, data: updatedLead, requestId: correlationId },
      { headers: { ...PRIVATE_HEADERS, 'X-Request-Id': correlationId } }
    );
  } catch (err: unknown) {
    if (err instanceof UnauthorizedError) {
      return errorResponse(401, 'AUTH_REQUIRED', correlationId);
    }
    if (err instanceof ForbiddenError) {
      return errorResponse(403, 'AGENT_PERMISSION_REQUIRED', correlationId);
    }
    return errorResponse(500, 'LEAD_UPDATE_FAILED', correlationId);
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  return PUT(request, context);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const correlationId = requestId(request);
  try {
    const { id } = await params;
    if (!id) return errorResponse(400, 'INVALID_LEAD_ID', correlationId);

    const ctx = await requireRole('admin');
    const supabase = getSupabaseAdminClient();

    const { error: delError } = await supabase
      .from('leads')
      .delete()
      .eq('id', id)
      .eq('account_id', ctx.accountId);

    if (delError) {
      return errorResponse(
        500,
        'LEAD_DELETE_FAILED',
        correlationId,
        delError.message
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Lead deleted successfully',
        requestId: correlationId,
      },
      { headers: { ...PRIVATE_HEADERS, 'X-Request-Id': correlationId } }
    );
  } catch (err: unknown) {
    if (err instanceof UnauthorizedError) {
      return errorResponse(401, 'AUTH_REQUIRED', correlationId);
    }
    if (err instanceof ForbiddenError) {
      return errorResponse(403, 'ADMIN_PERMISSION_REQUIRED', correlationId);
    }
    return errorResponse(500, 'LEAD_DELETE_FAILED', correlationId);
  }
}
