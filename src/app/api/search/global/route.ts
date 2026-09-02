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

export async function GET(request: NextRequest): Promise<NextResponse> {
  const correlationId = requestId(request);
  try {
    const q = request.nextUrl.searchParams.get('q')?.trim();
    if (!q || q.length < 2) {
      return NextResponse.json(
        {
          data: { contacts: [], deals: [], appointments: [] },
          requestId: correlationId,
        },
        { headers: { ...PRIVATE_HEADERS, 'X-Request-Id': correlationId } }
      );
    }

    const context = await requireRole('viewer');
    const supabase = getSupabaseAdminClient();
    const accountIndustry = (context.account as { industry?: string })
      ?.industry;
    const supportsAppointments = [
      'hospital_clinic',
      'salon',
      'travel',
    ].includes(
      accountIndustry === 'health' ? 'hospital_clinic' : accountIndustry || ''
    );

    const [contactsRes, dealsRes, appointmentsRes] = await Promise.all([
      // 1. Search Contacts
      supabase
        .from('contacts')
        .select('id, name, phone, email, company, entity_type')
        .eq('account_id', context.accountId)
        .or(
          `name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%,company.ilike.%${q}%`
        )
        .limit(10),

      // 2. Search Deals
      supabase
        .from('deals')
        .select('id, name, value, currency, status, stage_id')
        .eq('account_id', context.accountId)
        .ilike('name', `%${q}%`)
        .limit(10),

      // 3. Search Appointments (only for industries supporting appointments)
      supportsAppointments
        ? supabase
            .from('appointments')
            .select(
              'id, starts_at, status, notes, contact:contacts(name, phone)'
            )
            .eq('account_id', context.accountId)
            .ilike('notes', `%${q}%`)
            .limit(10)
        : Promise.resolve({ data: [] }),
    ]);

    return NextResponse.json(
      {
        data: {
          contacts: contactsRes.data || [],
          deals: dealsRes.data || [],
          appointments: appointmentsRes.data || [],
        },
        requestId: correlationId,
      },
      { headers: { ...PRIVATE_HEADERS, 'X-Request-Id': correlationId } }
    );
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
    console.error('[global search] Error:', err);
    return NextResponse.json({ error: 'SEARCH_FAILED' }, { status: 500 });
  }
}
