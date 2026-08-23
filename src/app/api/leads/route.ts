import { NextRequest, NextResponse } from 'next/server';
import {
  ForbiddenError,
  UnauthorizedError,
  requireRole,
} from '@/lib/auth/account';
import { getAdminClient as getSupabaseAdminClient } from '@/lib/supabase/server';
import { dispatchCrmEvent } from '@/core/events';

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

export async function GET(request: NextRequest): Promise<NextResponse> {
  const correlationId = requestId(request);
  try {
    const ctx = await requireRole('viewer');
    const supabase = getSupabaseAdminClient();
    const { searchParams } = request.nextUrl;

    const stage = searchParams.get('stage');
    const channel = searchParams.get('channel');
    const source = searchParams.get('source');
    const score = searchParams.get('score');
    const assignedUserId = searchParams.get('assigned_user_id');
    const search = searchParams.get('search');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get('limit') || '50', 10))
    );
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10));

    let query = supabase
      .from('leads')
      .select('*, contacts(*)', { count: 'exact' })
      .eq('account_id', ctx.accountId);

    if (stage && stage !== 'all') {
      query = query.eq('stage', stage);
    }
    if (channel && channel !== 'all') {
      query = query.eq('channel', channel);
    }
    if (source && source !== 'all') {
      query = query.eq('source', source);
    }
    if (score && score !== 'all') {
      query = query.or(`score.eq.${score},lead_score.eq.${score}`);
    }
    if (assignedUserId) {
      query = query.eq('assigned_user_id', assignedUserId);
    }
    if (dateFrom) {
      query = query.gte('created_at', dateFrom);
    }
    if (dateTo) {
      query = query.lte('created_at', dateTo);
    }
    if (search && search.trim()) {
      const term = search.trim();
      query = query.or(
        `name.ilike.%${term}%,phone.ilike.%${term}%,email.ilike.%${term}%,service.ilike.%${term}%`
      );
    }

    const {
      data: leads,
      count,
      error,
    } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('[leads] GET query failed:', {
        requestId: correlationId,
        code: error.code,
        message: error.message,
      });
      return errorResponse(
        500,
        'LEADS_FETCH_FAILED',
        correlationId,
        'Unable to load leads.'
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: leads || [],
        total: count ?? (leads ? leads.length : 0),
        limit,
        offset,
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
    console.error('[leads] GET unhandled error:', {
      requestId: correlationId,
      error: err,
    });
    return errorResponse(
      500,
      'LEADS_FETCH_FAILED',
      correlationId,
      'Unable to load leads.'
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const correlationId = requestId(request);
  try {
    const ctx = await requireRole('agent');
    const supabase = getSupabaseAdminClient();
    const body = await request.json();

    const {
      name,
      phone,
      email,
      service = 'General Inquiry',
      stage = 'NEW',
      source = 'whatsapp',
      channel = 'whatsapp',
      score = 'warm',
      lead_score,
      value = 0,
      currency = 'INR',
      assigned_user_id,
      notes,
      contact_id,
      metadata = {},
    } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return errorResponse(
        400,
        'NAME_REQUIRED',
        correlationId,
        'Lead name is required.'
      );
    }

    const normalizedPhone = phone ? String(phone).replace(/[^\d+]/g, '') : null;

    // Optional deduplication against existing active leads for this phone/email in this tenant
    let linkedContactId = contact_id || null;
    if (!linkedContactId && (normalizedPhone || email)) {
      let contactQuery = supabase
        .from('contacts')
        .select('id')
        .eq('account_id', ctx.accountId);

      if (normalizedPhone && email) {
        contactQuery = contactQuery.or(
          `phone.eq.${normalizedPhone},email.eq.${email}`
        );
      } else if (normalizedPhone) {
        contactQuery = contactQuery.eq('phone', normalizedPhone);
      } else if (email) {
        contactQuery = contactQuery.eq('email', email);
      }

      const { data: existingContact } = await contactQuery
        .limit(1)
        .maybeSingle();
      if (existingContact) {
        linkedContactId = existingContact.id;
      }
    }

    const { data: newLead, error: insertError } = await supabase
      .from('leads')
      .insert({
        account_id: ctx.accountId,
        contact_id: linkedContactId,
        name: name.trim(),
        phone: normalizedPhone,
        email: email ? String(email).trim().toLowerCase() : null,
        service: service ? String(service).trim() : 'General Inquiry',
        stage: String(stage).toUpperCase(),
        source: source ? String(source) : 'whatsapp',
        channel: channel ? String(channel) : 'whatsapp',
        score: score ? String(score).toLowerCase() : 'warm',
        lead_score: lead_score
          ? String(lead_score)
          : score
            ? String(score).toLowerCase()
            : 'warm',
        value: Number(value) || 0,
        currency: currency ? String(currency).toUpperCase() : 'INR',
        assigned_user_id: assigned_user_id || null,
        notes: notes ? String(notes).trim() : null,
        metadata: metadata || {},
      })
      .select('*, contacts(*)')
      .single();

    if (insertError || !newLead) {
      console.error('[leads] POST insert failed:', {
        requestId: correlationId,
        code: insertError?.code,
        message: insertError?.message,
      });
      return errorResponse(
        500,
        'LEAD_CREATE_FAILED',
        correlationId,
        'Unable to create lead.'
      );
    }

    // Record creation in lead activities
    await supabase.from('lead_activities').insert({
      account_id: ctx.accountId,
      lead_id: newLead.id,
      actor_user_id: ctx.userId,
      activity_type: 'lead_created',
      next_stage: newLead.stage,
      notes: notes || 'Lead captured',
      metadata: { source: newLead.source, channel: newLead.channel },
    });

    // Dispatch CRM Event
    try {
      await dispatchCrmEvent({
        eventType: 'deal.created',
        accountId: ctx.accountId,
        contactId: linkedContactId || undefined,
        payload: {
          leadId: newLead.id,
          name: newLead.name,
          stage: newLead.stage,
          service: newLead.service,
        },
      });
    } catch (eventErr) {
      console.warn('[leads] CRM event dispatch failed:', eventErr);
    }

    return NextResponse.json(
      {
        success: true,
        data: newLead,
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
    console.error('[leads] POST unhandled error:', {
      requestId: correlationId,
      error: err,
    });
    return errorResponse(
      500,
      'LEAD_CREATE_FAILED',
      correlationId,
      'Unable to create lead.'
    );
  }
}
