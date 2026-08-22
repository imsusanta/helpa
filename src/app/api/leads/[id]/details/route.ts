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
    const { id: leadId } = await params;
    if (!leadId) {
      return errorResponse(400, 'LEAD_ID_REQUIRED', correlationId);
    }

    const ctx = await requireRole('viewer');
    const supabase = getSupabaseAdminClient();

    // 1. Fetch Lead with linked contact
    const { data: lead, error: leadErr } = await supabase
      .from('leads')
      .select('*, contacts(*)')
      .eq('id', leadId)
      .eq('account_id', ctx.accountId)
      .maybeSingle();

    if (leadErr || !lead) {
      return errorResponse(
        404,
        'LEAD_NOT_FOUND',
        correlationId,
        'Lead not found.'
      );
    }

    const contactId = lead.contact_id;

    // 2. Parallel queries for related history, notes, tasks, conversation, appointments
    const [
      stageHistoryRes,
      notesRes,
      tasksRes,
      appointmentsRes,
      conversationRes,
      assigneeRes,
    ] = await Promise.all([
      supabase
        .from('lead_activities')
        .select('*')
        .eq('lead_id', leadId)
        .eq('account_id', ctx.accountId)
        .order('created_at', { ascending: false }),

      supabase
        .from('lead_notes')
        .select('*')
        .eq('lead_id', leadId)
        .eq('account_id', ctx.accountId)
        .order('created_at', { ascending: false }),

      supabase
        .from('tasks')
        .select('*')
        .eq('account_id', ctx.accountId)
        .or(
          `lead_id.eq.${leadId}${contactId ? `,contact_id.eq.${contactId}` : ''}`
        )
        .order('due_at', { ascending: true }),

      contactId
        ? supabase
            .from('appointments')
            .select('*')
            .eq('account_id', ctx.accountId)
            .eq('contact_id', contactId)
            .order('appointment_date', { ascending: false })
            .limit(10)
        : Promise.resolve({ data: [] }),

      contactId
        ? supabase
            .from('conversations')
            .select('*, messages(*)')
            .eq('account_id', ctx.accountId)
            .eq('contact_id', contactId)
            .maybeSingle()
        : Promise.resolve({ data: null }),

      lead.assigned_user_id
        ? supabase
            .from('profiles')
            .select('id, user_id, full_name, email, avatar_url')
            .eq('user_id', lead.assigned_user_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const conversation = conversationRes.data;
    const messages = conversation?.messages || [];

    return NextResponse.json(
      {
        success: true,
        data: {
          lead: {
            ...lead,
            title: lead.name,
            contact: lead.contacts,
            assignee: assigneeRes.data,
          },
          consents: [],
          appointments: appointmentsRes.data || [],
          stageHistory: stageHistoryRes.data || [],
          notes: notesRes.data || [],
          calls: [],
          conversation: conversation || null,
          messages: messages || [],
          followups: tasksRes.data || [],
          role: ctx.role || 'owner',
        },
        requestId: correlationId,
      },
      { headers: { ...PRIVATE_HEADERS, 'X-Request-Id': correlationId } }
    );
  } catch (err: unknown) {
    if (err instanceof UnauthorizedError) {
      return errorResponse(401, 'AUTH_REQUIRED', correlationId);
    }
    if (err instanceof ForbiddenError) {
      return errorResponse(403, 'ACCOUNT_MEMBERSHIP_REQUIRED', correlationId);
    }
    console.error('[leads] details unhandled error:', err);
    return errorResponse(500, 'LEAD_DETAILS_FETCH_FAILED', correlationId);
  }
}
