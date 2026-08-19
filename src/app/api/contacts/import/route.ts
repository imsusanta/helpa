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

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  return digits.startsWith('+') ? digits : `+${digits}`;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const correlationId = requestId(request);
  try {
    const context = await requireRole('agent');
    const supabase = getSupabaseAdminClient();
    const body = await request.json();

    const { contacts, duplicateStrategy = 'skip', tagIds = [] } = body;

    if (!Array.isArray(contacts) || contacts.length === 0) {
      return errorResponse(400, 'CONTACTS_ARRAY_REQUIRED', correlationId);
    }

    if (contacts.length > 1000) {
      return errorResponse(400, 'BATCH_LIMIT_EXCEEDED_MAX_1000', correlationId);
    }

    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    const errors: Array<{ row: number; reason: string }> = [];

    // Pre-fetch existing contacts for duplicate phone lookup
    const { data: existingContacts } = await supabase
      .from('contacts')
      .select('id, phone, email')
      .eq('account_id', context.accountId);

    const phoneMap = new Map<string, string>();
    (existingContacts || []).forEach((c) => {
      if (c.phone) phoneMap.set(c.phone, c.id);
    });

    for (let i = 0; i < contacts.length; i++) {
      const row = contacts[i];
      const rawName = String(row.name || '').trim();
      const rawPhone = String(row.phone || '').trim();
      const rawEmail = row.email ? String(row.email).trim() : null;
      const rawAddress = row.address ? String(row.address).trim() : null;

      if (!rawName || !rawPhone) {
        errors.push({ row: i + 1, reason: 'Missing name or phone number' });
        continue;
      }

      const phone = normalizePhone(rawPhone);
      const existingId = phoneMap.get(phone);

      if (existingId) {
        if (duplicateStrategy === 'skip') {
          skippedCount++;
          continue;
        } else if (duplicateStrategy === 'update') {
          const { error: updateErr } = await supabase
            .from('contacts')
            .update({
              name: rawName,
              email: rawEmail,
              address: rawAddress,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingId)
            .eq('account_id', context.accountId);

          if (updateErr) {
            errors.push({ row: i + 1, reason: updateErr.message });
          } else {
            updatedCount++;
            // Attach tags if specified
            if (Array.isArray(tagIds) && tagIds.length > 0) {
              for (const tagId of tagIds) {
                await supabase.from('contact_tags').upsert(
                  {
                    account_id: context.accountId,
                    contact_id: existingId,
                    tag_id: tagId,
                  },
                  { onConflict: 'contact_id,tag_id' }
                );
              }
            }
          }
          continue;
        }
      }

      // Insert new contact
      const { data: inserted, error: insertErr } = await supabase
        .from('contacts')
        .insert({
          account_id: context.accountId,
          user_id: context.userId,
          name: rawName,
          phone,
          email: rawEmail,
          address: rawAddress,
          consent_status: 'pending',
          metadata: {},
        })
        .select('id')
        .single();

      if (insertErr || !inserted) {
        errors.push({
          row: i + 1,
          reason: insertErr ? insertErr.message : 'Insert failed',
        });
      } else {
        createdCount++;
        phoneMap.set(phone, inserted.id);

        // Attach tags
        if (Array.isArray(tagIds) && tagIds.length > 0) {
          for (const tagId of tagIds) {
            await supabase.from('contact_tags').insert({
              account_id: context.accountId,
              contact_id: inserted.id,
              tag_id: tagId,
            });
          }
        }
      }
    }

    return NextResponse.json(
      {
        data: {
          totalProcessed: contacts.length,
          createdCount,
          updatedCount,
          skippedCount,
          errors,
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
    return errorResponse(500, 'CONTACT_IMPORT_FAILED', correlationId);
  }
}
