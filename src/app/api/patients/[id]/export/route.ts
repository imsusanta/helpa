import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/db/server';
import { toErrorResponse } from '@/lib/auth/account';
import { requireHealthWorkplace } from '@/lib/auth/industry';
import { logger } from '@/lib/observability/logger';
import { scrubSensitiveFields } from '@/lib/privacy/consent-service';
import {
  checkRateLimit,
  rateLimitResponse,
  RATE_LIMITS,
} from '@/lib/rate-limit';

const CACHE_HEADERS = {
  'Cache-Control': 'private, no-store, no-cache, must-revalidate',
} as const;

/**
 * Defines which patient fields are safe to include in a data export.
 * Never include service keys, internal tokens, or unrelated tenant data.
 */
const EXPORT_SELECT_FIELDS = [
  'id',
  'account_id',
  'name',
  'phone',
  'email',
  'gender',
  'date_of_birth',
  'blood_group',
  'emergency_contact',
  'consent_status',
  'consent_source',
  'consent_updated_at',
  'policy_version',
  'patient_seq_id',
  'created_at',
  'updated_at',
] as const;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Authenticate and authorize — derive identity from server session in Health workplace
    const ctx = await requireHealthWorkplace('admin');
    const accountId = ctx.accountId;
    const actorId = ctx.userId;

    // Rate limit check: 10/min per user
    const rl = await checkRateLimit(
      `export:${actorId}`,
      RATE_LIMITS.patientExport
    );
    if (!rl.success) return rateLimitResponse(rl);

    const { id: patientId } = await params;
    const UUID_REGEX =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!patientId || !UUID_REGEX.test(patientId)) {
      return NextResponse.json(
        { error: 'Invalid patient ID format' },
        { status: 400, headers: CACHE_HEADERS }
      );
    }

    const db = getAdminClient();

    // 2. Fetch patient — scoped by server-derived accountId
    const { data: patient, error: fetchErr } = await db
      .from('patients')
      .select(EXPORT_SELECT_FIELDS.join(', '))
      .eq('id', patientId)
      .eq('account_id', accountId)
      .maybeSingle();

    if (fetchErr || !patient) {
      return NextResponse.json(
        { error: 'Not found' },
        { status: 404, headers: CACHE_HEADERS }
      );
    }

    // 3. Fetch related records for the export
    const [appointmentsRes, consentHistoryRes] = await Promise.all([
      db
        .from('appointments')
        .select(
          'id, appointment_date, appointment_time, status, department, created_at'
        )
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })
        .limit(50),
      db
        .from('audit_logs')
        .select('action, metadata, created_at')
        .eq('account_id', accountId)
        .eq('resource_type', 'patients')
        .eq('resource_id', patientId)
        .in('action', ['patient.consent_updated', 'patient.consent_withdrawn'])
        .order('created_at', { ascending: false })
        .limit(50),
    ]);

    // 4. Scrub any internal fields that may have leaked through
    const scrubbedPatient = scrubSensitiveFields(
      patient as unknown as Record<string, unknown>
    );

    // 5. Record audit event for the export
    const { error: auditErr } = await db.from('audit_logs').insert({
      account_id: accountId,
      actor_id: actorId,
      action: 'patient.data_exported',
      resource_type: 'patients',
      resource_id: patientId,
      metadata: { exported_at: new Date().toISOString() },
    });

    if (auditErr) {
      logger.error('Failed to record export audit event', {
        component: 'export-api',
        accountId,
        correlationId: patientId,
      });
      // Fail the export — unaudited exports are not acceptable
      return NextResponse.json(
        { error: 'Export audit recording failed' },
        { status: 500, headers: CACHE_HEADERS }
      );
    }

    const exportPayload = {
      exported_at: new Date().toISOString(),
      patient: scrubbedPatient,
      appointments: appointmentsRes.data || [],
      consent_history: consentHistoryRes.data || [],
    };

    return NextResponse.json(exportPayload, {
      headers: {
        ...CACHE_HEADERS,
        'Content-Disposition': `attachment; filename="patient-export-${patientId}.json"`,
        'Content-Type': 'application/json',
      },
    });
  } catch (err: unknown) {
    return toErrorResponse(err);
  }
}
