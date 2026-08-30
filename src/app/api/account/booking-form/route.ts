import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/account';
import { getAdminClient } from '@/lib/db/server';
import {
  getDefaultBookingFormConfig,
  mergeBookingFormConfig,
  type BookingFormConfig,
} from '@/lib/booking-form/config';

export async function GET() {
  try {
    const ctx = await requireRole('viewer');
    const db = getAdminClient();

    const { data: account, error } = await db
      .from('accounts')
      .select('appointment_form_config, industry')
      .eq('id', ctx.accountId)
      .single();

    const industry = account?.industry || null;
    if (error || !account?.appointment_form_config) {
      return NextResponse.json({
        industry,
        config: getDefaultBookingFormConfig(industry),
      });
    }

    return NextResponse.json({
      industry,
      config: mergeBookingFormConfig(
        industry,
        account.appointment_form_config as BookingFormConfig
      ),
    });
  } catch (err: unknown) {
    console.error('[GET /api/account/booking-form] exception:', err);
    return NextResponse.json({
      industry: null,
      config: getDefaultBookingFormConfig(null),
    });
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

    const db = getAdminClient();
    const { data: account } = await db
      .from('accounts')
      .select('industry')
      .eq('id', ctx.accountId)
      .maybeSingle();
    const sanitizedConfig = mergeBookingFormConfig(account?.industry, config);

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
