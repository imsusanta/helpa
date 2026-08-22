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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const correlationId = requestId(request);
  try {
    const { id: leadId } = await params;
    if (!leadId) return errorResponse(400, 'INVALID_LEAD_ID', correlationId);

    const ctx = await requireRole('agent');
    const supabase = getSupabaseAdminClient();
    const body = await request.json();

    const { note_text } = body;
    if (!note_text || typeof note_text !== 'string' || !note_text.trim()) {
      return errorResponse(
        400,
        'NOTE_TEXT_REQUIRED',
        correlationId,
        'Note text cannot be empty.'
      );
    }

    // Verify lead belongs to this tenant
    const { data: lead } = await supabase
      .from('leads')
      .select('id')
      .eq('id', leadId)
      .eq('account_id', ctx.accountId)
      .maybeSingle();

    if (!lead) {
      return errorResponse(
        404,
        'LEAD_NOT_FOUND',
        correlationId,
        'Lead not found.'
      );
    }

    const { data: newNote, error: noteErr } = await supabase
      .from('lead_notes')
      .insert({
        account_id: ctx.accountId,
        lead_id: leadId,
        author_id: ctx.userId,
        note_text: note_text.trim(),
      })
      .select()
      .single();

    if (noteErr || !newNote) {
      return errorResponse(
        500,
        'NOTE_CREATE_FAILED',
        correlationId,
        noteErr?.message
      );
    }

    // Record activity
    await supabase.from('lead_activities').insert({
      account_id: ctx.accountId,
      lead_id: leadId,
      actor_user_id: ctx.userId,
      activity_type: 'note_added',
      notes: note_text.trim(),
    });

    return NextResponse.json(
      {
        success: true,
        data: newNote,
        requestId: correlationId,
      },
      {
        status: 201,
        headers: { ...PRIVATE_HEADERS, 'X-Request-Id': correlationId },
      }
    );
  } catch (err: unknown) {
    if (err instanceof UnauthorizedError) {
      return errorResponse(401, 'AUTH_REQUIRED', correlationId);
    }
    if (err instanceof ForbiddenError) {
      return errorResponse(403, 'AGENT_PERMISSION_REQUIRED', correlationId);
    }
    return errorResponse(500, 'NOTE_CREATE_FAILED', correlationId);
  }
}
