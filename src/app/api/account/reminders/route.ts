import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import {
  checkRateLimit,
  rateLimitResponse,
  RATE_LIMITS,
} from '@/lib/rate-limit';

export async function GET() {
  try {
    const ctx = await requireRole('admin');

    const { data: account, error } = await ctx.admin
      .from('accounts')
      .select(
        'reminder_enabled, reminder_24h_enabled, reminder_2h_enabled, reminder_custom_time, reminder_template, reminder_business_hours'
      )
      .eq('id', ctx.accountId)
      .single();

    if (error) {
      console.error('[GET /api/account/reminders] fetch error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch reminder configuration' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      reminder_enabled: account?.reminder_enabled ?? true,
      reminder_24h_enabled: account?.reminder_24h_enabled ?? true,
      reminder_2h_enabled: account?.reminder_2h_enabled ?? true,
      reminder_custom_time: account?.reminder_custom_time ?? null,
      reminder_template: account?.reminder_template || '',
      reminder_business_hours: account?.reminder_business_hours || {
        enabled: false,
        start: '09:00',
        end: '17:00',
      },
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function PATCH(request: Request) {
  try {
    const ctx = await requireRole('admin');

    const limit = await checkRateLimit(
      `admin:reminders-config:${ctx.userId}`,
      RATE_LIMITS.adminAction
    );
    if (!limit.success) return rateLimitResponse(limit);

    const body = await request.json().catch(() => null);
    const reminder_enabled = body?.reminder_enabled;
    const reminder_24h_enabled = body?.reminder_24h_enabled;
    const reminder_2h_enabled = body?.reminder_2h_enabled;
    const reminder_custom_time = body?.reminder_custom_time;
    const reminder_template = body?.reminder_template;
    const reminder_business_hours = body?.reminder_business_hours;

    const updates: Record<string, unknown> = {};

    if (typeof reminder_enabled === 'boolean') {
      updates.reminder_enabled = reminder_enabled;
    }
    if (typeof reminder_24h_enabled === 'boolean') {
      updates.reminder_24h_enabled = reminder_24h_enabled;
    }
    if (typeof reminder_2h_enabled === 'boolean') {
      updates.reminder_2h_enabled = reminder_2h_enabled;
    }
    if (
      typeof reminder_custom_time === 'number' ||
      reminder_custom_time === null
    ) {
      updates.reminder_custom_time = reminder_custom_time;
    }
    if (typeof reminder_template === 'string') {
      updates.reminder_template = reminder_template;
    }
    if (
      typeof reminder_business_hours === 'object' &&
      reminder_business_hours !== null
    ) {
      updates.reminder_business_hours = reminder_business_hours;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields provided' },
        { status: 400 }
      );
    }

    const { data, error } = await ctx.admin
      .from('accounts')
      .update(updates)
      .eq('id', ctx.accountId)
      .select(
        'reminder_enabled, reminder_24h_enabled, reminder_2h_enabled, reminder_custom_time, reminder_template, reminder_business_hours'
      )
      .single();

    if (error) {
      console.error('[PATCH /api/account/reminders] update error:', error);
      return NextResponse.json(
        { error: 'Failed to update reminder configuration' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      reminder_enabled: data?.reminder_enabled ?? true,
      reminder_24h_enabled: data?.reminder_24h_enabled ?? true,
      reminder_2h_enabled: data?.reminder_2h_enabled ?? true,
      reminder_custom_time: data?.reminder_custom_time ?? null,
      reminder_template: data?.reminder_template || '',
      reminder_business_hours: data?.reminder_business_hours || {
        enabled: false,
        start: '09:00',
        end: '17:00',
      },
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
