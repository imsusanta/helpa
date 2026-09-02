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
  correlationId: string
): NextResponse {
  return NextResponse.json(
    { error: code, requestId: correlationId },
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
    if (!id) return errorResponse(400, 'INVALID_CONTACT_ID', correlationId);

    const context = await requireRole('viewer');
    const supabase = getSupabaseAdminClient();

    // 1. Fetch Contact Record
    const { data: contact, error: contactErr } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', id)
      .eq('account_id', context.accountId)
      .maybeSingle();

    if (contactErr || !contact) {
      return errorResponse(404, 'CONTACT_NOT_FOUND', correlationId);
    }

    // 2. Parallel fetch associated entities: tags, custom field values, conversations, deals, appointments, notes
    const [
      tagsRes,
      customValuesRes,
      conversationsRes,
      dealsRes,
      appointmentsRes,
      notesRes,
    ] = await Promise.all([
      supabase
        .from('contact_tags')
        .select('tag_id, tags(id, name, color)')
        .eq('account_id', context.accountId)
        .eq('contact_id', id),
      supabase
        .from('custom_field_values')
        .select('*, custom_fields(id, name, key, field_type)')
        .eq('account_id', context.accountId)
        .eq('contact_id', id),
      supabase
        .from('conversations')
        .select(
          'id, channel, status, unread_count, last_message_at, created_at'
        )
        .eq('account_id', context.accountId)
        .eq('contact_id', id)
        .order('last_message_at', { ascending: false }),
      supabase
        .from('deals')
        .select(
          'id, name, value, currency, status, stage_id, pipeline_id, expected_close_date, created_at'
        )
        .eq('account_id', context.accountId)
        .eq('contact_id', id)
        .order('created_at', { ascending: false }),
      supabase
        .from('appointments')
        .select(
          'id, appointment_date, appointment_time, status, notes, created_at'
        )
        .eq('account_id', context.accountId)
        .eq('patient_id', id)
        .order('appointment_date', { ascending: false }),
      supabase
        .from('contact_notes')
        .select('id, note_text, created_at')
        .eq('account_id', context.accountId)
        .eq('contact_id', id)
        .order('created_at', { ascending: false }),
    ]);

    const tags = (tagsRes.data || [])
      .map((item: Record<string, unknown>) => item.tags)
      .filter(Boolean);

    const customFields = (customValuesRes.data || []).map(
      (val: Record<string, unknown>) => ({
        id: val.id,
        custom_field_id: val.custom_field_id,
        definition: val.custom_fields,
        value:
          val.value_text ??
          val.value_number ??
          val.value_date ??
          val.value_json ??
          null,
      })
    );

    return NextResponse.json(
      {
        data: {
          ...contact,
          tags,
          customFields,
          conversations: conversationsRes.data || [],
          deals: dealsRes.data || [],
          appointments: appointmentsRes.data || [],
          notes: notesRes.data || [],
        },
        requestId: correlationId,
      },
      { headers: { ...PRIVATE_HEADERS, 'X-Request-Id': correlationId } }
    );
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return errorResponse(401, 'AUTH_REQUIRED', correlationId);
    }
    if (error instanceof ForbiddenError) {
      return errorResponse(403, 'ACCOUNT_MEMBERSHIP_REQUIRED', correlationId);
    }
    return errorResponse(500, 'CONTACT_FETCH_FAILED', correlationId);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const correlationId = requestId(request);
  try {
    const { id } = await params;
    if (!id) return errorResponse(400, 'INVALID_CONTACT_ID', correlationId);

    const context = await requireRole('agent');
    const supabase = getSupabaseAdminClient();
    const body = await request.json();

    const {
      name,
      phone,
      email,
      address,
      metadata,
      consent_status,
      tags,
      customFields,
    } = body;

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (name !== undefined) updatePayload.name = String(name).trim();
    if (phone !== undefined) updatePayload.phone = String(phone).trim();
    if (email !== undefined)
      updatePayload.email = email ? String(email).trim() : null;
    if (address !== undefined)
      updatePayload.address = address ? String(address).trim() : null;
    if (metadata !== undefined) updatePayload.metadata = metadata;
    if (consent_status !== undefined)
      updatePayload.consent_status = consent_status;

    const { data: updatedContact, error: updateErr } = await supabase
      .from('contacts')
      .update(updatePayload)
      .eq('id', id)
      .eq('account_id', context.accountId)
      .select()
      .single();

    if (updateErr) {
      console.error('[contacts] Update failed:', updateErr);
      return errorResponse(500, updateErr.message, correlationId);
    }

    // Update tags if provided
    if (Array.isArray(tags)) {
      await supabase
        .from('contact_tags')
        .delete()
        .eq('account_id', context.accountId)
        .eq('contact_id', id);

      if (tags.length > 0) {
        const tagRows = tags.map((tagId: string) => ({
          account_id: context.accountId,
          contact_id: id,
          tag_id: tagId,
        }));
        await supabase.from('contact_tags').insert(tagRows);
      }
    }

    // Update custom field values if provided
    if (customFields && typeof customFields === 'object') {
      for (const [fieldId, val] of Object.entries(customFields)) {
        let valueText: string | null = null;
        let valueNumber: number | null = null;
        let valueDate: string | null = null;
        let valueJson: unknown = null;

        if (typeof val === 'number') {
          valueNumber = val;
        } else if (typeof val === 'boolean') {
          valueJson = val;
        } else if (
          Array.isArray(val) ||
          (typeof val === 'object' && val !== null)
        ) {
          valueJson = val;
        } else if (typeof val === 'string') {
          if (/^\d{4}-\d{2}-\d{2}/.test(val)) {
            valueDate = val;
          } else {
            valueText = val;
          }
        }

        await supabase.from('custom_field_values').upsert(
          {
            account_id: context.accountId,
            contact_id: id,
            custom_field_id: fieldId,
            value_text: valueText,
            value_number: valueNumber,
            value_date: valueDate,
            value_json: valueJson,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'contact_id,custom_field_id' }
        );
      }
    }

    return NextResponse.json(
      { data: updatedContact, requestId: correlationId },
      { headers: { ...PRIVATE_HEADERS, 'X-Request-Id': correlationId } }
    );
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return errorResponse(401, 'AUTH_REQUIRED', correlationId);
    }
    if (error instanceof ForbiddenError) {
      return errorResponse(403, 'ACCOUNT_MEMBERSHIP_REQUIRED', correlationId);
    }
    return errorResponse(500, 'CONTACT_UPDATE_FAILED', correlationId);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const correlationId = requestId(request);
  try {
    const { id } = await params;
    if (!id) return errorResponse(400, 'INVALID_CONTACT_ID', correlationId);

    const context = await requireRole('admin');
    const supabase = getSupabaseAdminClient();

    const { error: delErr } = await supabase
      .from('contacts')
      .delete()
      .eq('id', id)
      .eq('account_id', context.accountId);

    if (delErr) {
      console.error('[contacts] Delete failed:', delErr);
      return errorResponse(500, delErr.message, correlationId);
    }

    return NextResponse.json(
      { success: true, requestId: correlationId },
      { headers: { ...PRIVATE_HEADERS, 'X-Request-Id': correlationId } }
    );
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return errorResponse(401, 'AUTH_REQUIRED', correlationId);
    }
    if (error instanceof ForbiddenError) {
      return errorResponse(403, 'ACCOUNT_MEMBERSHIP_REQUIRED', correlationId);
    }
    return errorResponse(500, 'CONTACT_DELETE_FAILED', correlationId);
  }
}
