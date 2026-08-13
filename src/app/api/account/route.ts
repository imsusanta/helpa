// ============================================================
// /api/account
//
//   GET   — current caller's account + role. Any member.
//   PATCH — update account settings (name, default_currency). Admin+.
//
// Why both verbs share a route file
//   They speak about the same singular resource (the caller's
//   account) and reuse the same `requireRole` plumbing.
// ============================================================

import { NextResponse } from 'next/server';

import {
  requireRole,
  getCurrentAccount,
  toErrorResponse,
} from '@/lib/auth/account';
import {
  checkRateLimit,
  rateLimitResponse,
  RATE_LIMITS,
} from '@/lib/rate-limit';
import { CURRENCIES } from '@/lib/currency';

export async function GET() {
  try {
    const ctx = await getCurrentAccount();
    return NextResponse.json({
      account: ctx.account,
      role: ctx.role,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}

const MAX_NAME_LEN = 80;
const VALID_CURRENCY_CODES = new Set(CURRENCIES.map((c) => c.code));

export async function PATCH(request: Request) {
  try {
    const ctx = await requireRole('admin');

    const limit = checkRateLimit(
      `admin:update:${ctx.userId}`,
      RATE_LIMITS.adminAction
    );
    if (!limit.success) return rateLimitResponse(limit);

    const body = (await request.json().catch(() => null)) as {
      name?: unknown;
      default_currency?: unknown;
      defaultCurrency?: unknown;
    } | null;

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Invalid JSON request body' },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = {};

    if (body.name !== undefined) {
      if (typeof body.name !== 'string') {
        return NextResponse.json(
          { error: "'name' must be a string" },
          { status: 400 }
        );
      }
      const name = body.name.trim();
      if (name.length === 0) {
        return NextResponse.json(
          { error: 'Account name cannot be empty' },
          { status: 400 }
        );
      }
      if (name.length > MAX_NAME_LEN) {
        return NextResponse.json(
          { error: `Account name must be ${MAX_NAME_LEN} characters or fewer` },
          { status: 400 }
        );
      }
      updates.name = name;
    }

    const rawCurrency = body.default_currency ?? body.defaultCurrency;
    if (rawCurrency !== undefined) {
      if (typeof rawCurrency !== 'string') {
        return NextResponse.json(
          { error: "'default_currency' must be a string" },
          { status: 400 }
        );
      }
      const currency = rawCurrency.trim().toUpperCase();
      if (!VALID_CURRENCY_CODES.has(currency)) {
        return NextResponse.json(
          { error: `Invalid currency code '${currency}'` },
          { status: 400 }
        );
      }
      updates.default_currency = currency;
      updates.defaultCurrency = currency;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields provided to update' },
        { status: 400 }
      );
    }

    const { data, error } = await ctx.appwrite
      .from('accounts')
      .update(updates)
      .eq('id', ctx.accountId)
      .select('*')
      .maybeSingle();

    if (error) {
      console.error('[PATCH /api/account] update error:', error);
      return NextResponse.json(
        {
          error: `Failed to update account: ${error.message || 'Database error'}`,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      account: data || { ...ctx.account, ...updates },
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
