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
