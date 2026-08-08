import { supabaseAdmin } from '@/lib/automations/admin-client';

export async function generateNextPatientSeqId(
  accountId: string
): Promise<string> {
  try {
    const db = supabaseAdmin();
    const { data: maxPatient } = await db
      .from('patients')
      .select('patient_seq_id')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let nextNum = 1;
    if (maxPatient?.patient_seq_id) {
      const numMatch = maxPatient.patient_seq_id.match(/\d+/);
      if (numMatch) {
        nextNum = parseInt(numMatch[0], 10) + 1;
      }
    }

    return `PAT-${String(nextNum).padStart(6, '0')}`;
  } catch (err) {
    console.error('Error generating Patient ID:', err);
    return `PAT-${String(Math.floor(100000 + Math.random() * 900000))}`;
  }
}

export function getOrGeneratePatientId(
  contact?: { id?: string; metadata?: any } | null,
  patientSeqId?: string | null
): string {
  if (
    patientSeqId &&
    patientSeqId.trim() !== '' &&
    patientSeqId !== '—' &&
    patientSeqId !== 'PAT-000000'
  ) {
    return patientSeqId;
  }
  const metaId =
    contact?.metadata?.patient_id || contact?.metadata?.patient_seq_id;
  if (
    typeof metaId === 'string' &&
    metaId.trim() !== '' &&
    metaId !== '—' &&
    metaId !== 'PAT-000000'
  ) {
    return metaId;
  }

  if (contact?.id) {
    const digits = contact.id.replace(/\D/g, '');
    const numeric =
      digits.length >= 6 ? digits.slice(0, 6) : digits.padEnd(6, '1');
    return `PAT-${numeric.padStart(6, '0')}`;
  }

  return 'PAT-000001';
}

export function resolveBloodGroup(
  patientBg?: string | null,
  metaBg?: string | null,
  reports?: Array<{
    test_name?: string;
    notes?: string;
    internal_notes?: string;
  }> | null
): { bg: string | null; source: 'patient' | 'report' | null } {
  // 1. Direct patient setting
  if (patientBg && patientBg.trim() && patientBg !== '—') {
    return { bg: patientBg.trim().toUpperCase(), source: 'patient' };
  }
  if (metaBg && metaBg.trim() && metaBg !== '—') {
    return { bg: metaBg.trim().toUpperCase(), source: 'patient' };
  }

  // 2. Extract from lab reports text
  if (reports && reports.length > 0) {
    const bgShortRegex = /\b(A\+|A\-|B\+|B\-|AB\+|AB\-|O\+|O\-)\b/i;
    const bgWordsRegex = /\b(A|B|AB|O)\s+(positive|negative|pos|neg)\b/i;

    for (const rep of reports) {
      const text = `${rep.test_name || ''} ${rep.notes || ''} ${rep.internal_notes || ''}`;

      const shortMatch = text.match(bgShortRegex);
      if (shortMatch) {
        return { bg: shortMatch[0].toUpperCase(), source: 'report' };
      }

      const wordMatch = text.match(bgWordsRegex);
      if (wordMatch) {
        const grp = wordMatch[1].toUpperCase();
        const sign = wordMatch[2].toLowerCase().startsWith('pos') ? '+' : '-';
        return { bg: `${grp}${sign}`, source: 'report' };
      }
    }
  }

  return { bg: null, source: null };
}
