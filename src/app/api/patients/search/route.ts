import { NextResponse } from 'next/server';
import { toErrorResponse } from '@/lib/auth/account';
import { requireHealthWorkplace } from '@/lib/auth/industry';
import { getAdminClient } from '@/lib/db/server';
import { getOrGeneratePatientId } from '@/lib/patients/id-generator';

export async function GET(request: Request) {
  try {
    const ctx = await requireHealthWorkplace('agent');
    const { searchParams } = new URL(request.url);
    const phone = searchParams.get('phone')?.trim() || '';
    const queryTerm = searchParams.get('query')?.trim() || '';

    if (!phone && !queryTerm) {
      return NextResponse.json({ patients: [] });
    }

    const db = getAdminClient();
    const cleanPhone = (phone || queryTerm).replace(/\D/g, '');

    // Search contacts matching account_id and phone
    let query = db
      .from('contacts')
      .select('id, name, phone, email, address, metadata')
      .eq('account_id', ctx.accountId);

    if (cleanPhone.length >= 4) {
      const lastDigits = cleanPhone.slice(-10);
      query = query.ilike('phone', `%${lastDigits}%`);
    } else if (queryTerm) {
      query = query.or(`name.ilike.%${queryTerm}%,phone.ilike.%${queryTerm}%`);
    }

    const { data: contacts, error } = await query.limit(10);

    if (error || !contacts || contacts.length === 0) {
      return NextResponse.json({ patients: [] });
    }

    const contactIds = contacts.map((c) => c.id);

    // Fetch patient details (patient_seq_id, gender, date_of_birth, blood_group)
    const { data: patientsData } = await db
      .from('patients')
      .select(
        'id, patient_seq_id, gender, date_of_birth, blood_group, emergency_contact'
      )
      .in('id', contactIds);

    const patientsMap = new Map<string, Record<string, unknown>>();
    patientsData?.forEach((p) =>
      patientsMap.set(p.id, p as Record<string, unknown>)
    );

    const result = contacts.map((c) => {
      const p = patientsMap.get(c.id);
      const meta =
        c.metadata && typeof c.metadata === 'object'
          ? (c.metadata as Record<string, unknown>)
          : {};
      return {
        id: c.id,
        patient_seq_id: getOrGeneratePatientId(c, p?.patient_seq_id as string),
        name: c.name || 'Unnamed Patient',
        phone: c.phone || '',
        email: c.email || '',
        address: c.address || '',
        gender:
          (p?.gender as string) || (meta.gender as string) || 'Not Specified',
        date_of_birth:
          (p?.date_of_birth as string) || (meta.dob as string) || null,
        blood_group:
          (p?.blood_group as string) || (meta.blood_group as string) || null,
        emergency_contact:
          (p?.emergency_contact as string) ||
          (meta.emergency_contact as string) ||
          null,
      };
    });

    return NextResponse.json({ patients: result });
  } catch (err: unknown) {
    return toErrorResponse(err);
  }
}
