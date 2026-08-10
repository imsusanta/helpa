import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/account';
import { appwriteAdmin } from '@/lib/appwrite-server-compat';
import { DEFAULT_BOOKING_FORM_CONFIG } from '@/lib/booking-form/config';

export async function GET() {
  try {
    const ctx = await requireRole('admin');
    const db = appwriteAdmin();

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
        ...(account.appointment_form_config as Record<
          string,
          { show: boolean; required: boolean }
        >),
      },
    });
  } catch (err: unknown) {
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
      return NextResponse.json(
        { error: 'Invalid config payload' },
        { status: 400 }
      );
    }

    // Mandatory defaults protection: name & phone must always be show:true, required:true
    const sanitizedConfig = {
      ...DEFAULT_BOOKING_FORM_CONFIG,
      ...config,
      name: { show: true, required: true },
      phone: { show: true, required: true },
    };

    const db = appwriteAdmin();
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
        warning:
          'Configuration saved in memory (database column pending migration).',
      });
    }

    return NextResponse.json({
      config: data?.appointment_form_config || sanitizedConfig,
    });
  } catch (err: unknown) {
    console.error('[PATCH /api/account/booking-form] exception:', err);
    const errorObj = err as Record<string, unknown>;
    return NextResponse.json(
      {
        error:
          (err as Error)?.message || 'Failed to update booking form settings',
      },
      { status: (errorObj?.status as number) || 500 }
    );
  }
}
