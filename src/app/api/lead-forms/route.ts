import { NextRequest, NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { getAdminClient as getSupabaseAdminClient } from '@/lib/supabase/server';
import { FORM_FIELD_TYPES } from '@/lib/marketing/form-fields';
import type { LeadFormField } from '@/types';

const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store, no-cache, must-revalidate',
};

/** Validates the builder's field list before it is ever persisted. */
export function sanitizeFields(raw: unknown): LeadFormField[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 20) return null;
  const seen = new Set<string>();
  const fields: LeadFormField[] = [];
  for (const item of raw) {
    const f = item as Partial<LeadFormField>;
    if (
      !f ||
      typeof f.key !== 'string' ||
      !/^[a-z0-9_]{1,40}$/.test(f.key) ||
      typeof f.label !== 'string' ||
      !f.label.trim() ||
      f.label.length > 80
    ) {
      return null;
    }
    if (seen.has(f.key)) return null;
    seen.add(f.key);
    const type = FORM_FIELD_TYPES.includes(
      f.type as (typeof FORM_FIELD_TYPES)[number]
    )
      ? f.type
      : 'text';
    fields.push({
      key: f.key,
      label: f.label.trim(),
      type: type as LeadFormField['type'],
      required: Boolean(f.required),
    });
  }
  // A capture form without name/phone can never create a usable lead.
  if (!fields.some((f) => f.key === 'name')) return null;
  if (!fields.some((f) => f.key === 'phone')) return null;
  return fields;
}

export async function GET(): Promise<NextResponse> {
  try {
    const context = await requireRole('viewer');
    const supabase = getSupabaseAdminClient();

    const { data: forms, error } = await supabase
      .from('lead_forms')
      .select('*')
      .eq('account_id', context.accountId)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500, headers: PRIVATE_HEADERS }
      );
    }

    // Aggregate submission stats in-memory (single tenant-scoped scan).
    const { data: rows } = await supabase
      .from('form_submissions')
      .select('form_id, status')
      .eq('account_id', context.accountId);

    const stats = new Map<string, { submissions: number; newLeads: number }>();
    for (const row of rows ?? []) {
      const bucket = stats.get(row.form_id) ?? { submissions: 0, newLeads: 0 };
      bucket.submissions += 1;
      if (row.status === 'new') bucket.newLeads += 1;
      stats.set(row.form_id, bucket);
    }

    const enriched = (forms ?? []).map((form) => ({
      ...form,
      submission_count: stats.get(form.id)?.submissions ?? 0,
      new_leads_count: stats.get(form.id)?.newLeads ?? 0,
    }));

    return NextResponse.json({ data: enriched }, { headers: PRIVATE_HEADERS });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const context = await requireRole('agent');
    const supabase = getSupabaseAdminClient();
    const body = await request.json();

    const name =
      typeof body?.name === 'string' ? body.name.trim().slice(0, 120) : '';
    if (!name) {
      return NextResponse.json(
        { error: 'Form name is required' },
        { status: 400, headers: PRIVATE_HEADERS }
      );
    }

    const fields = sanitizeFields(body?.fields);
    if (!fields) {
      return NextResponse.json(
        {
          error: 'Fields are invalid — at minimum Name and Phone are required',
        },
        { status: 400, headers: PRIVATE_HEADERS }
      );
    }

    const status = ['draft', 'active', 'paused'].includes(body?.status)
      ? body.status
      : 'draft';
    const description =
      typeof body?.description === 'string'
        ? body.description.trim().slice(0, 300)
        : null;
    const successMessage =
      typeof body?.success_message === 'string'
        ? body.success_message.trim().slice(0, 500)
        : null;

    const { data, error } = await supabase
      .from('lead_forms')
      .insert({
        account_id: context.accountId,
        created_by: context.userId,
        name,
        description,
        fields,
        success_message: successMessage,
        status,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500, headers: PRIVATE_HEADERS }
      );
    }

    return NextResponse.json(
      { data },
      { status: 201, headers: PRIVATE_HEADERS }
    );
  } catch (err) {
    return toErrorResponse(err);
  }
}
