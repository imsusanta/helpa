import { NextRequest, NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { findPlanBySlug } from '@/core/billing/plans';
import {
  createRazorpayOrder,
  getRazorpayCredentials,
} from '@/lib/billing/razorpay';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const context = await requireRole('owner');
    const body = (await request.json().catch(() => ({}))) as {
      planSlug?: string;
      planId?: string;
    };

    const rawSlug = body?.planSlug || body?.planId;
    if (!rawSlug) {
      return NextResponse.json(
        { error: 'A planSlug or planId is required' },
        { status: 400 }
      );
    }

    const planSlug = String(rawSlug)
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '');

    const targetPlan = await findPlanBySlug(planSlug);
    if (!targetPlan || !targetPlan.isActive) {
      return NextResponse.json(
        { error: `Plan '${planSlug}' not found or inactive` },
        { status: 404 }
      );
    }

    // The one-time setup fee is owed until a captured payment that
    // included it exists. platform_payments is the source of truth —
    // the subscriptions table has no setup-fee column, so deriving this
    // from the subscription silently waived the fee for every account.
    const { count: setupFeePayments } = await context.admin
      .from('platform_payments')
      .select('id', { count: 'exact', head: true })
      .eq('account_id', context.accountId)
      .eq('status', 'captured')
      .eq('is_setup_fee_included', true);

    const isFirstTime = (setupFeePayments ?? 0) === 0;
    const totalAmountInInr = isFirstTime
      ? targetPlan.setupFee + targetPlan.monthlyPrice
      : targetPlan.monthlyPrice;

    const amountInPaise = Math.round(totalAmountInInr * 100);
    const receipt = `rcpt_${context.accountId.slice(0, 8)}_${Date.now().toString().slice(-6)}`;

    const order = await createRazorpayOrder({
      amountInPaise,
      currency: targetPlan.currency || 'INR',
      receipt,
      notes: {
        accountId: context.accountId,
        planSlug: targetPlan.slug,
        isFirstTime: String(isFirstTime),
        userId: context.userId,
      },
    });

    const { keyId } = getRazorpayCredentials();

    return NextResponse.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId,
      receipt: order.receipt,
      plan: {
        id: targetPlan.id,
        name: targetPlan.name,
        slug: targetPlan.slug,
        setupFee: targetPlan.setupFee,
        monthlyPrice: targetPlan.monthlyPrice,
        isFirstTime,
        totalAmountInInr,
      },
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
