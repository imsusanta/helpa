import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { getAdminClient as getSupabaseAdminClient } from '@/lib/supabase/server';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { validateSubmissionData } from '@/lib/marketing/form-fields';
import { runAutomationsForTrigger } from '@/lib/automations/engine';

const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store, no-cache, must-revalidate',
};

/** Public intake is intentionally strict — a burst from one IP is absorbed. */
const PUBLIC_FORM_RATE_LIMIT = {
  limit: 5,
  windowMs: 60_000,
} as const;

function clientIp(request: NextRequest): string {
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return request.headers.get('x-real-ip') || 'unknown';
}

/**
 * GET — public form definition for rendering the shareable form.
 * Returns only submitter-safe data: title, description, field list and
 * the configured success message. No account ids, tokens or secrets.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
): Promise<NextResponse> {
  try {
    const { token } = await params;

    if (!/^[0-9a-f-]{36}$/i.test(token)) {
      return NextResponse.json(
        { error: 'Form not found' },
        { status: 404, headers: PRIVATE_HEADERS }
      );
    }

    const supabase = getSupabaseAdminClient();
    const { data: form, error } = await supabase
      .from('lead_forms')
      .select('name, description, fields, success_message, status')
      .eq('public_token', token)
      .single();

    // Draft/paused/missing forms are indistinguishable to callers so a
    // guessed token reveals nothing.
    if (error || !form || form.status !== 'active') {
      return NextResponse.json(
        { error: 'This form is currently unavailable.' },
        { status: 404, headers: PRIVATE_HEADERS }
      );
    }

    return NextResponse.json(
      {
        data: {
          name: form.name,
          description: form.description,
          fields: form.fields,
          success_message: form.success_message,
        },
      },
      { headers: PRIVATE_HEADERS }
    );
  } catch {
    return NextResponse.json(
      { error: 'Unable to load this form right now.' },
      { status: 500, headers: PRIVATE_HEADERS }
    );
  }
}

/**
 * POST — public lead capture.
 *
 * Security model:
 * - Opaque share token resolves the tenant; nothing client-supplied ever
 *   picks the account.
 * - Per-IP fixed-window rate limiting absorbs spam bursts.
 * - Honeypot field rejects bots silently (see validateSubmissionData).
 * - Every value is validated server-side against the stored definition;
 *   lengths are capped and emails/phones normalized before persistence.
 * - Contact matching is strictly tenant-scoped by phone/email — no
 *   duplicate contacts, no cross-tenant reads.
 * - Raw IPs are never stored, only a per-form SHA-256 fingerprint for
 *   abuse forensics.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
): Promise<NextResponse> {
  try {
    const { token } = await params;

    if (!/^[0-9a-f-]{36}$/i.test(token)) {
      return NextResponse.json(
        { error: 'Form not found' },
        { status: 404, headers: PRIVATE_HEADERS }
      );
    }

    const rl = checkRateLimit(
      `public-form:${clientIp(request)}`,
      PUBLIC_FORM_RATE_LIMIT
    );
    if (!rl.success) {
      return rateLimitResponse(rl);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid request' },
        { status: 400, headers: PRIVATE_HEADERS }
      );
    }

    const payload = (body ?? {}) as {
      values?: Record<string, unknown>;
      company_website?: string;
    };

    const supabase = getSupabaseAdminClient();

    const { data: form, error: formError } = await supabase
      .from('lead_forms')
      .select('id, account_id, fields, status')
      .eq('public_token', token)
      .single();

    if (formError || !form || form.status !== 'active') {
      return NextResponse.json(
        { error: 'This form is currently unavailable.' },
        { status: 404, headers: PRIVATE_HEADERS }
      );
    }

    const { data, violations } = validateSubmissionData(
      form.fields as never,
      { ...payload.values, company_website: payload.company_website }
    );

    if (violations.length > 0) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          violations,
        },
        { status: 400, headers: PRIVATE_HEADERS }
      );
    }

    const accountId = String(form.account_id);
    const name = data.name || '';
    const phone = data.phone || null;
    const email = data.email || null;

    // ── Tenant-scoped contact find-or-create ────────────────────────
    let contactId: string | null = null;
    let contactQuery = supabase
      .from('contacts')
      .select('id, name')
      .eq('account_id', accountId);

    if (phone && email) {
      contactQuery = contactQuery.or(`phone.eq.${phone},email.eq.${email}`);
    } else if (phone) {
      contactQuery = contactQuery.eq('phone', phone);
    } else if (email) {
      contactQuery = contactQuery.eq('email', email);
    }

    const { data: existingContact } = await contactQuery
      .limit(1)
      .maybeSingle();

    if (existingContact) {
      contactId = existingContact.id;
      // Enrich an anonymous record with the name provided on the form.
      if (
        name &&
        (!existingContact.name || existingContact.name.trim() === '')
      ) {
        await supabase
          .from('contacts')
          .update({ name })
          .eq('id', contactId)
          .eq('account_id', accountId);
      }
    } else {
      const { data: createdContact, error: contactError } = await supabase
        .from('contacts')
        .insert({
          account_id: accountId,
          name,
          phone,
          email,
        })
        .select('id')
        .single();
      if (contactError || !createdContact) {
        return NextResponse.json(
          { error: 'Unable to save your details right now.' },
          { status: 500, headers: PRIVATE_HEADERS }
        );
      }
      contactId = createdContact.id;
    }

    // ── Create the lead (same pipeline as manual CRM entry) ─────────
    const service = data.service || data.course || 'Website Enquiry';
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .insert({
        account_id: accountId,
        contact_id: contactId,
        name: name || 'Website Lead',
        phone,
        email,
        service: String(service).slice(0, 120),
        stage: 'NEW',
        source: 'website_form',
        channel: 'website',
        score: 'warm',
        metadata: {
          lead_form_id: form.id,
          submitted_fields: Object.keys(data),
        },
      })
      .select('id')
      .single();

    if (leadError || !lead) {
      return NextResponse.json(
        { error: 'Unable to save your enquiry right now.' },
        { status: 500, headers: PRIVATE_HEADERS }
      );
    }

    // ── Persist the submission record ───────────────────────────────
    const ipFingerprint = createHash('sha256')
      .update(`${clientIp(request)}:${form.id}`)
      .digest('hex');

    const { error: insertError } = await supabase
      .from('form_submissions')
      .insert({
        account_id: accountId,
        form_id: form.id,
        contact_id: contactId,
        lead_id: lead.id,
        data,
        status: 'new',
        source: 'website_form',
        ip_hash: ipFingerprint,
        user_agent: (request.headers.get('user-agent') || '').slice(0, 300),
      });

    if (insertError) {
      return NextResponse.json(
        { error: 'Unable to save your enquiry right now.' },
        { status: 500, headers: PRIVATE_HEADERS }
      );
    }

    // ── Automation hook (fire-and-forget, never blocks the response) ─
    void runAutomationsForTrigger({
      accountId,
      triggerType: 'form_submitted',
      contactId,
      context: {
        vars: {
          form_name: String((form as { name?: string }).name ?? ''),
          form_id: String(form.id),
        },
      },
    }).catch(() => undefined);

    return NextResponse.json({ success: true }, { headers: PRIVATE_HEADERS });
  } catch {
    return NextResponse.json(
      { error: 'Unable to submit this form right now.' },
      { status: 500, headers: PRIVATE_HEADERS }
    );
  }
}
