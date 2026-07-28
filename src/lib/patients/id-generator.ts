import { supabaseAdmin } from '@/lib/automations/admin-client';

export async function generateNextPatientSeqId(accountId: string): Promise<string> {
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
  contact?: { id: string; metadata?: any } | null,
  patientSeqId?: string | null
): string {
  if (patientSeqId) return patientSeqId;
  if (contact?.metadata?.patient_id) return contact.metadata.patient_id;
  if (contact?.metadata?.patient_seq_id) return contact.metadata.patient_seq_id;

  if (contact?.id) {
    const digits = contact.id.replace(/\D/g, '');
    const numeric = digits.length >= 6 ? digits.slice(0, 6) : digits.padEnd(6, '1');
    return `PAT-${numeric.padStart(6, '0')}`;
  }

  return 'PAT-000001';
}

