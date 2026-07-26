import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/account';
import { supabaseAdmin } from '@/lib/automations/admin-client';

export async function GET(request: Request) {
  try {
    const ctx = await requireRole('agent');
    const { searchParams } = new URL(request.url);
    const phone = searchParams.get('phone')?.trim() || '';
    const queryTerm = searchParams.get('query')?.trim() || '';

    if (!phone && !queryTerm) {
      return NextResponse.json({ patients: [] });
    }

    const db = supabaseAdmin();
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
      .select('id, patient_seq_id, gender, date_of_birth, blood_group, emergency_contact')
      .in('id', contactIds);

    const patientsMap = new Map<string, any>();
    patientsData?.forEach((p) => patientsMap.set(p.id, p));

    const result = contacts.map((c) => {
      const p = patientsMap.get(c.id);
      const meta = c.metadata && typeof c.metadata === 'object' ? c.metadata : {};
      return {
        id: c.id,
        patient_seq_id: p?.patient_seq_id || meta.patient_id || 'PAT-000000',
        name: c.name || 'Unnamed Patient',
        phone: c.phone || '',
        email: c.email || '',
        address: c.address || '',
        gender: p?.gender || meta.gender || 'Not Specified',
        date_of_birth: p?.date_of_birth || meta.dob || null,
        blood_group: p?.blood_group || meta.blood_group || null,
        emergency_contact: p?.emergency_contact || meta.emergency_contact || null,
      };
    });

    return NextResponse.json({ patients: result });
  } catch (err: any) {
    console.error('[GET /api/patients/search] exception:', err);
    return NextResponse.json({ patients: [] }, { status: 200 });
  }
}
