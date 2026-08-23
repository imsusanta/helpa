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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const correlationId = requestId(request);
  try {
    const { id } = await params;
    if (!id) return errorResponse(400, 'INVALID_LEAD_ID', correlationId);

    const ctx = await requireRole('agent');
    const supabase = getSupabaseAdminClient();
    const body = await request.json().catch(() => ({}));

    // Fetch lead
    const { data: lead, error: fetchErr } = await supabase
      .from('leads')
      .select('*, contacts(*)')
      .eq('id', id)
      .eq('account_id', ctx.accountId)
      .maybeSingle();

    if (fetchErr || !lead) {
      return errorResponse(
        404,
        'LEAD_NOT_FOUND',
        correlationId,
        'Lead not found.'
      );
    }

    // Idempotent check: if already converted, fetch linked contact/deal and return
    if (lead.converted_at && lead.converted_contact_id) {
      const { data: existingContact } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', lead.converted_contact_id)
        .maybeSingle();

      let existingDeal = null;
      if (lead.converted_deal_id) {
        const { data: d } = await supabase
          .from('deals')
          .select('*')
          .eq('id', lead.converted_deal_id)
          .maybeSingle();
        existingDeal = d;
      }

      return NextResponse.json(
        {
          success: true,
          data: {
            lead,
            contact: existingContact,
            deal: existingDeal,
            alreadyConverted: true,
          },
          requestId: correlationId,
        },
        { headers: { ...PRIVATE_HEADERS, 'X-Request-Id': correlationId } }
      );
    }

    // 1. Find or create Contact in contacts table
    let contact = lead.contacts;
    if (!contact) {
      // Check by phone or email
      if (lead.phone || lead.email) {
        let contactQ = supabase
          .from('contacts')
          .select('*')
          .eq('account_id', ctx.accountId);

        if (lead.phone && lead.email) {
          contactQ = contactQ.or(
            `phone.eq.${lead.phone},email.eq.${lead.email}`
          );
        } else if (lead.phone) {
          contactQ = contactQ.eq('phone', lead.phone);
        } else if (lead.email) {
          contactQ = contactQ.eq('email', lead.email);
        }

        const { data: found } = await contactQ.limit(1).maybeSingle();
        contact = found;
      }

      // If still not found, create contact
      if (!contact) {
        const { data: createdContact, error: contactErr } = await supabase
          .from('contacts')
          .insert({
            account_id: ctx.accountId,
            user_id: ctx.userId,
            name: lead.name,
            phone: lead.phone || `+910000000000`,
            email: lead.email || null,
            tags: ['Customer', 'Converted Lead'],
            metadata: {
              converted_from_lead_id: lead.id,
              service: lead.service,
            },
          })
          .select()
          .single();

        if (contactErr || !createdContact) {
          console.error('[leads] Contact creation during conversion failed:', {
            requestId: correlationId,
            code: contactErr?.code,
            message: contactErr?.message,
          });
          return errorResponse(
            500,
            'CONTACT_CREATE_FAILED',
            correlationId,
            'Unable to create customer contact from lead.'
          );
        }
        contact = createdContact;
      }
    }

    // 2. Optionally create Deal if requested
    let createdDeal: { id: string; name: string } | null = null;
    const { createDeal, dealName, dealValue, pipelineId, stageId } = body;
    if (createDeal || pipelineId) {
      let targetPipelineId = pipelineId;
      let targetStageId = stageId;

      // If no pipeline provided, lookup default pipeline
      if (!targetPipelineId) {
        const { data: defaultPipe } = await supabase
          .from('pipelines')
          .select('id, pipeline_stages(id, order_index)')
          .eq('account_id', ctx.accountId)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (defaultPipe) {
          targetPipelineId = defaultPipe.id;
          if (!targetStageId && defaultPipe.pipeline_stages?.length) {
            const sortedStages = [...defaultPipe.pipeline_stages].sort(
              (a, b) => a.order_index - b.order_index
            );
            targetStageId = sortedStages[0]?.id;
          }
        }
      }

      if (targetPipelineId && targetStageId) {
        const { data: newDeal, error: dealErr } = await supabase
          .from('deals')
          .insert({
            account_id: ctx.accountId,
            pipeline_id: targetPipelineId,
            stage_id: targetStageId,
            contact_id: contact.id,
            assigned_user_id: lead.assigned_user_id || ctx.userId,
            name: dealName || `${lead.name} - ${lead.service || 'Deal'}`,
            value: dealValue !== undefined ? Number(dealValue) : lead.value,
            currency: lead.currency || 'INR',
            source: lead.source || 'lead_conversion',
            notes: lead.notes || null,
            status: 'open',
          })
          .select()
          .single();

        if (!dealErr && newDeal) {
          createdDeal = newDeal;
        }
      }
    }

    const now = new Date().toISOString();

    // 3. Update lead to CONVERTED
    const { data: convertedLead, error: updateLeadErr } = await supabase
      .from('leads')
      .update({
        stage: 'CONVERTED',
        contact_id: contact.id,
        converted_at: now,
        converted_contact_id: contact.id,
        converted_deal_id: createdDeal?.id || null,
        updated_at: now,
      })
      .eq('id', id)
      .eq('account_id', ctx.accountId)
      .select('*, contacts(*)')
      .single();

    if (updateLeadErr || !convertedLead) {
      console.error('[leads] update to CONVERTED failed:', {
        requestId: correlationId,
        code: updateLeadErr?.code,
        message: updateLeadErr?.message,
      });
      return errorResponse(
        500,
        'LEAD_CONVERT_FAILED',
        correlationId,
        'Unable to convert lead.'
      );
    }

    // 4. Record lead activity
    await supabase.from('lead_activities').insert({
      account_id: ctx.accountId,
      lead_id: id,
      actor_user_id: ctx.userId,
      activity_type: 'converted',
      previous_stage: lead.stage,
      next_stage: 'CONVERTED',
      notes: `Lead converted to customer ${contact.name}${createdDeal ? ` and deal ${createdDeal.name}` : ''}`,
      metadata: { contact_id: contact.id, deal_id: createdDeal?.id },
    });

    // 5. Dispatch CRM Event
    try {
      await dispatchCrmEvent({
        eventType: 'contact.created',
        accountId: ctx.accountId,
        contactId: contact.id,
        payload: {
          leadId: lead.id,
          contactId: contact.id,
          dealId: createdDeal?.id,
        },
      });
    } catch (eventErr) {
      console.warn('[leads] Convert event dispatch failed:', eventErr);
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          lead: convertedLead,
          contact,
          deal: createdDeal,
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
      return errorResponse(403, 'AGENT_PERMISSION_REQUIRED', correlationId);
    }
    console.error('[leads] convert unhandled error:', {
      requestId: correlationId,
      error: err,
    });
    return errorResponse(
      500,
      'LEAD_CONVERT_FAILED',
      correlationId,
      'Unable to convert lead.'
    );
  }
}
