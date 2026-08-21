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
const MAX_BULK_SIZE = 100;

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
    { error: code, message, requestId: correlationId },
    { status, headers: { ...PRIVATE_HEADERS, 'X-Request-Id': correlationId } }
  );
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const correlationId = requestId(request);
  try {
    const body = await request.json();
    const { action, contact_ids, payload } = body;

    const VALID_ACTIONS = [
      'assign',
      'add_tag',
      'remove_tag',
      'move_stage',
      'create_followup',
      'delete',
    ] as const;

    if (
      !action ||
      !VALID_ACTIONS.includes(action as (typeof VALID_ACTIONS)[number])
    ) {
      return errorResponse(
        400,
        'INVALID_ACTION',
        correlationId,
        `Action must be one of: ${VALID_ACTIONS.join(', ')}`
      );
    }

    if (
      !Array.isArray(contact_ids) ||
      contact_ids.length === 0 ||
      contact_ids.length > MAX_BULK_SIZE
    ) {
      return errorResponse(
        400,
        'INVALID_PAYLOAD',
        correlationId,
        'contact_ids must be a non-empty array with max 100 items.'
      );
    }

    const requiredRole = action === 'delete' ? 'admin' : 'agent';
    const context = await requireRole(requiredRole);
    const supabase = getSupabaseAdminClient();

    // 1. Strict Tenant Isolation: Only process contacts belonging to the authenticated account
    const { data: validContacts, error: verifyErr } = await supabase
      .from('contacts')
      .select('id')
      .eq('account_id', context.accountId)
      .in('id', contact_ids);

    if (verifyErr) {
      console.error('[contacts bulk] verification error:', verifyErr);
      return errorResponse(500, 'VERIFICATION_FAILED', correlationId);
    }

    const validIds = (validContacts || []).map((c) => c.id);
    if (validIds.length === 0) {
      return errorResponse(
        404,
        'NO_MATCHING_CONTACTS',
        correlationId,
        'None of the selected contacts belong to your workspace.'
      );
    }

    // 2. Execute Action
    switch (action) {
      case 'assign': {
        const assignedUserId = payload?.assigned_user_id || null;
        if (assignedUserId) {
          // Verify assigned user belongs to this account
          const { data: member } = await supabase
            .from('account_members')
            .select('user_id')
            .eq('account_id', context.accountId)
            .eq('user_id', assignedUserId)
            .maybeSingle();

          if (!member) {
            // Also check profiles for backwards compatibility
            const { data: prof } = await supabase
              .from('profiles')
              .select('id')
              .eq('account_id', context.accountId)
              .or(`id.eq.${assignedUserId},user_id.eq.${assignedUserId}`)
              .maybeSingle();

            if (!prof) {
              return errorResponse(
                400,
                'INVALID_ASSIGNED_USER',
                correlationId,
                'The selected team member is not part of this workspace.'
              );
            }
          }
        }

        const { error: updateErr } = await supabase
          .from('contacts')
          .update({ assigned_user_id: assignedUserId })
          .eq('account_id', context.accountId)
          .in('id', validIds);

        if (updateErr) {
          console.error('[contacts bulk] assign error:', updateErr);
          return errorResponse(500, 'ASSIGN_FAILED', correlationId);
        }

        return NextResponse.json(
          { success: true, count: validIds.length, requestId: correlationId },
          { headers: { ...PRIVATE_HEADERS, 'X-Request-Id': correlationId } }
        );
      }

      case 'add_tag': {
        const tagId = payload?.tag_id;
        if (!tagId) {
          return errorResponse(400, 'TAG_ID_REQUIRED', correlationId);
        }

        // Verify tag belongs to current tenant
        const { data: tag } = await supabase
          .from('tags')
          .select('id')
          .eq('account_id', context.accountId)
          .eq('id', tagId)
          .maybeSingle();

        if (!tag) {
          return errorResponse(404, 'TAG_NOT_FOUND', correlationId);
        }

        const tagRows = validIds.map((contactId) => ({
          contact_id: contactId,
          tag_id: tagId,
          account_id: context.accountId,
        }));

        const { error: tagErr } = await supabase
          .from('contact_tags')
          .upsert(tagRows, { onConflict: 'contact_id,tag_id' });

        if (tagErr) {
          console.error('[contacts bulk] add tag error:', tagErr);
          return errorResponse(500, 'ADD_TAG_FAILED', correlationId);
        }

        return NextResponse.json(
          { success: true, count: validIds.length, requestId: correlationId },
          { headers: { ...PRIVATE_HEADERS, 'X-Request-Id': correlationId } }
        );
      }

      case 'remove_tag': {
        const tagId = payload?.tag_id;
        if (!tagId) {
          return errorResponse(400, 'TAG_ID_REQUIRED', correlationId);
        }

        const { error: removeErr } = await supabase
          .from('contact_tags')
          .delete()
          .eq('account_id', context.accountId)
          .eq('tag_id', tagId)
          .in('contact_id', validIds);

        if (removeErr) {
          console.error('[contacts bulk] remove tag error:', removeErr);
          return errorResponse(500, 'REMOVE_TAG_FAILED', correlationId);
        }

        return NextResponse.json(
          { success: true, count: validIds.length, requestId: correlationId },
          { headers: { ...PRIVATE_HEADERS, 'X-Request-Id': correlationId } }
        );
      }

      case 'move_stage': {
        const stage = payload?.stage;
        if (!stage) {
          return errorResponse(400, 'STAGE_REQUIRED', correlationId);
        }

        // Update contacts metadata stage
        for (const contactId of validIds) {
          await supabase
            .from('contacts')
            .update({
              metadata: {
                stage,
              },
            })
            .eq('id', contactId)
            .eq('account_id', context.accountId);
        }

        return NextResponse.json(
          { success: true, count: validIds.length, requestId: correlationId },
          { headers: { ...PRIVATE_HEADERS, 'X-Request-Id': correlationId } }
        );
      }

      case 'create_followup': {
        const followupType =
          payload?.followup_type || payload?.title || 'Follow-up Task';
        const dueDate =
          payload?.due_date || new Date().toISOString().split('T')[0];
        const notes = payload?.notes || null;
        const assignedUserId = payload?.assigned_user_id || null;

        const followupRows = validIds.map((contactId) => ({
          account_id: context.accountId,
          patient_id: contactId,
          followup_type: followupType,
          due_date: dueDate,
          notes,
          status: 'scheduled',
          assigned_user_id: assignedUserId,
        }));

        const { error: fuErr } = await supabase
          .from('hospital_followups')
          .insert(followupRows);

        if (fuErr) {
          console.error('[contacts bulk] create followup error:', fuErr);
          return errorResponse(500, 'CREATE_FOLLOWUP_FAILED', correlationId);
        }

        return NextResponse.json(
          { success: true, count: validIds.length, requestId: correlationId },
          { headers: { ...PRIVATE_HEADERS, 'X-Request-Id': correlationId } }
        );
      }

      case 'delete': {
        const { error: delErr } = await supabase
          .from('contacts')
          .delete()
          .eq('account_id', context.accountId)
          .in('id', validIds);

        if (delErr) {
          console.error('[contacts bulk] delete error:', delErr);
          return errorResponse(500, 'DELETE_FAILED', correlationId);
        }

        return NextResponse.json(
          { success: true, count: validIds.length, requestId: correlationId },
          { headers: { ...PRIVATE_HEADERS, 'X-Request-Id': correlationId } }
        );
      }

      default:
        return errorResponse(400, 'UNSUPPORTED_ACTION', correlationId);
    }
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return errorResponse(401, 'AUTH_REQUIRED', correlationId);
    }
    if (error instanceof ForbiddenError) {
      return errorResponse(403, 'INSUFFICIENT_PERMISSIONS', correlationId);
    }
    console.error('[contacts bulk] error:', error);
    return errorResponse(500, 'BULK_OPERATION_FAILED', correlationId);
  }
}
