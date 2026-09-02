import { NextRequest, NextResponse } from 'next/server';
import {
  ForbiddenError,
  UnauthorizedError,
  requireRole,
} from '@/lib/auth/account';
import { getAdminClient as getSupabaseAdminClient } from '@/lib/supabase/server';
import { isIndividualContact } from '@/core/whatsapp/group-identity';

import { sanitizeCsvValue } from '@/lib/csv-utils';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const context = await requireRole('viewer');
    const supabase = getSupabaseAdminClient();

    const { searchParams } = request.nextUrl;
    const idsParam = searchParams.get('ids');
    const search = searchParams.get('search')?.trim();

    let query = supabase
      .from('contacts')
      .select(
        'id, name, phone, email, address, metadata, created_at, assigned_user_id'
      )
      .eq('account_id', context.accountId)
      .order('created_at', { ascending: false });

    if (idsParam) {
      const ids = idsParam
        .split(',')
        .map((i) => i.trim())
        .filter(Boolean);
      if (ids.length > 0) {
        query = query.in('id', ids);
      }
    } else if (search) {
      query = query.or(
        `name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`
      );
    }

    const { data: contacts, error } = await query.limit(2000);

    if (error) {
      console.error('[contacts/export] Query failed:', error);
      return NextResponse.json(
        { error: 'EXPORT_QUERY_FAILED' },
        { status: 500 }
      );
    }

    const validContacts = (contacts || []).filter((c) =>
      isIndividualContact(c)
    );

    // Fetch tags for exported contacts
    const contactIds = validContacts.map((c) => c.id);
    const contactTagMap: Record<string, string[]> = {};
    if (contactIds.length > 0) {
      const { data: tagRows } = await supabase
        .from('contact_tags')
        .select('contact_id, tags(name)')
        .eq('account_id', context.accountId)
        .in('contact_id', contactIds);

      if (tagRows) {
        for (const row of tagRows as unknown as Array<{
          contact_id: string;
          tags: { name: string } | null;
        }>) {
          if (!contactTagMap[row.contact_id])
            contactTagMap[row.contact_id] = [];
          if (row.tags?.name) {
            contactTagMap[row.contact_id].push(row.tags.name);
          }
        }
      }
    }

    const headers = [
      'Name',
      'Phone',
      'Email',
      'Company',
      'Address',
      'Tags',
      'Notes',
      'Created At',
    ];

    const csvRows = [headers.map(sanitizeCsvValue).join(',')];

    for (const c of validContacts) {
      const tags = (contactTagMap[c.id] || []).join('; ');
      const meta = (c.metadata as Record<string, unknown>) || {};
      const company =
        (c as Record<string, unknown>).company || meta.company || '';
      const notes = (c as Record<string, unknown>).notes || meta.notes || '';
      const row = [
        c.name || '',
        c.phone || '',
        c.email || '',
        String(company),
        c.address || '',
        tags,
        String(notes),
        c.created_at || '',
      ];
      csvRows.push(row.map(sanitizeCsvValue).join(','));
    }

    const csvContent = csvRows.join('\r\n');
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `contacts-export-${dateStr}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'private, no-store, no-cache, must-revalidate',
      },
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json(
        { error: 'ACCOUNT_MEMBERSHIP_REQUIRED' },
        { status: 403 }
      );
    }
    console.error('[contacts/export] Error:', err);
    return NextResponse.json({ error: 'EXPORT_FAILED' }, { status: 500 });
  }
}
