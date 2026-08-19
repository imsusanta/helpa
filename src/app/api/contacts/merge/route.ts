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

export async function POST(request: NextRequest): Promise<NextResponse> {
  const correlationId = requestId(request);
  try {
    const context = await requireRole('admin');
    const supabase = getSupabaseAdminClient();
    const body = await request.json();

    const { primaryContactId, secondaryContactId } = body;
    if (
      !primaryContactId ||
      !secondaryContactId ||
      primaryContactId === secondaryContactId
    ) {
      return errorResponse(400, 'INVALID_MERGE_TARGETS', correlationId);
    }

    // Verify both contacts belong to tenant
    const { data: primary } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', primaryContactId)
      .eq('account_id', context.accountId)
      .single();

    const { data: secondary } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', secondaryContactId)
      .eq('account_id', context.accountId)
      .single();

    if (!primary || !secondary) {
      return errorResponse(
        404,
        'ONE_OR_BOTH_CONTACTS_NOT_FOUND',
        correlationId
      );
    }

    // 1. Move conversations
    await supabase
      .from('conversations')
      .update({
        contact_id: primaryContactId,
        updated_at: new Date().toISOString(),
      })
      .eq('account_id', context.accountId)
      .eq('contact_id', secondaryContactId);

    // 2. Move deals
    await supabase
      .from('deals')
      .update({
        contact_id: primaryContactId,
        updated_at: new Date().toISOString(),
      })
      .eq('account_id', context.accountId)
      .eq('contact_id', secondaryContactId);

    // 3. Move appointments
    await supabase
      .from('appointments')
      .update({
        contact_id: primaryContactId,
        updated_at: new Date().toISOString(),
      })
      .eq('account_id', context.accountId)
      .eq('contact_id', secondaryContactId);

    // 4. Move contact notes
    await supabase
      .from('contact_notes')
      .update({ contact_id: primaryContactId })
      .eq('account_id', context.accountId)
      .eq('contact_id', secondaryContactId);

    // 5. Transfer tags
    const { data: secTags } = await supabase
      .from('contact_tags')
      .select('tag_id')
      .eq('account_id', context.accountId)
      .eq('contact_id', secondaryContactId);

    if (secTags && secTags.length > 0) {
      for (const t of secTags) {
        await supabase.from('contact_tags').upsert(
          {
            account_id: context.accountId,
            contact_id: primaryContactId,
            tag_id: t.tag_id,
          },
          { onConflict: 'contact_id,tag_id' }
        );
      }
    }

    // 6. Delete secondary contact
    await supabase
      .from('contacts')
      .delete()
      .eq('id', secondaryContactId)
      .eq('account_id', context.accountId);

    return NextResponse.json(
      { success: true, primaryContactId, requestId: correlationId },
      { headers: { ...PRIVATE_HEADERS, 'X-Request-Id': correlationId } }
    );
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return errorResponse(401, 'AUTH_REQUIRED', correlationId);
    }
    if (error instanceof ForbiddenError) {
      return errorResponse(403, 'ACCOUNT_MEMBERSHIP_REQUIRED', correlationId);
    }
    return errorResponse(500, 'CONTACT_MERGE_FAILED', correlationId);
  }
}
