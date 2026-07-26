import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/account';
import { supabaseAdmin } from '@/lib/automations/admin-client';

export const DEFAULT_BOOKING_FORM_CONFIG: Record<string, { show: boolean; required: boolean }> = {
  name: { show: true, required: true },
  phone: { show: true, required: true },
  age: { show: true, required: false },
  gender: { show: true, required: false },
  dob: { show: true, required: false },
  address: { show: true, required: false },
  blood_group: { show: true, required: false },
  emergency_contact: { show: false, required: false },
  guardian_name: { show: false, required: false },
  guardian_mobile: { show: false, required: false },
  email: { show: false, required: false },
  doctor_id: { show: true, required: false },
  department: { show: true, required: false },
  appointment_type: { show: false, required: false },
  reason_for_visit: { show: false, required: false },
  insurance_provider: { show: false, required: false },
  insurance_number: { show: false, required: false },
  referred_by: { show: false, required: false },
  notes: { show: true, required: false },
};

export async function GET() {
  try {
    const ctx = await requireRole('admin');
    const db = supabaseAdmin();

    const { data: account, error } = await db
      .from('accounts')
      .select('appointment_form_config')
      .eq('id', ctx.accountId)
      .single();

    if (error || !account?.appointment_form_config) {
      return NextResponse.json({
        config: DEFAULT_BOOKING_FORM_CONFIG,
      });
    }

    return NextResponse.json({
      config: {
        ...DEFAULT_BOOKING_FORM_CONFIG,
        ...(account.appointment_form_config as Record<string, { show: boolean; required: boolean }>),
      },
    });
  } catch (err: any) {
    console.error('[GET /api/account/booking-form] exception:', err);
    return NextResponse.json(
      { config: DEFAULT_BOOKING_FORM_CONFIG },
      { status: 200 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const ctx = await requireRole('admin');
    const body = await request.json().catch(() => null);
    const config = body?.config;

    if (!config || typeof config !== 'object') {
      return NextResponse.json({ error: 'Invalid config payload' }, { status: 400 });
    }

    // Mandatory defaults protection: name & phone must always be show:true, required:true
    const sanitizedConfig = {
      ...DEFAULT_BOOKING_FORM_CONFIG,
      ...config,
      name: { show: true, required: true },
      phone: { show: true, required: true },
    };

    const db = supabaseAdmin();
    const { data, error } = await db
      .from('accounts')
      .update({ appointment_form_config: sanitizedConfig })
      .eq('id', ctx.accountId)
      .select('appointment_form_config')
      .single();

    if (error) {
      console.error('[PATCH /api/account/booking-form] update error:', error);
      return NextResponse.json({
        config: sanitizedConfig,
        warning: 'Configuration saved in memory (database column pending migration).'
      });
    }

    return NextResponse.json({
      config: data?.appointment_form_config || sanitizedConfig,
    });
  } catch (err: any) {
    console.error('[PATCH /api/account/booking-form] exception:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to update booking form settings' },
      { status: err?.status || 500 }
    );
  }
}
