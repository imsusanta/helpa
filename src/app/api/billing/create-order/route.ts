import { NextRequest, NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { getAdminClient } from '@/lib/db/server';
import { findPlanBySlug } from '@/core/billing/plans';
import {
  assertValidOrderAmountPaise,
  createRazorpayOrder,
  getRazorpayCredentials,
  InvalidOrderAmountError,
  RazorpayConfigurationError,
} from '@/lib/billing/razorpay';

/**
 * POST /api/billing/create-order — start a subscription payment.
 *
 * Security model:
 * - Owner-only. Non-owners cannot create orders for the workspace.
 * - The plan is validated against the server-side active catalog.
 * - Setup-fee eligibility is derived only from persisted data (the
 *   subscription row and captured platform_payments); a client-supplied
 *   isFirstTime flag is never trusted.
 * - The full expected charge is computed server-side in integer paise and
 *   persisted to billing_orders, which the webhook later uses to verify
 *   the captured amount, currency, plan, and account.
 * - Only the public keyId is returned to the client.
 */
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

    const db = getAdminClient();

    // Setup-fee eligibility from persisted state only. A missing
    // subscription row means the setup fee has NOT been paid.
    const { data: subRow, error: subErr } = await db
      .from('subscriptions')
      .select('id, setup_fee_paid')
      .eq('account_id', context.accountId)
      .maybeSingle();
    if (subErr) {
      console.error('[create-order] subscription lookup failed:', subErr);
      return NextResponse.json(
        { error: 'Unable to verify subscription state. Please try again.' },
        { status: 500 }
      );
    }

    let setupFeePaid = subRow?.setup_fee_paid === true;
    if (!setupFeePaid) {
      // Cross-check the payment ledger: a captured payment that included
      // the setup fee also settles eligibility.
      const { data: paidSetup, error: payErr } = await db
        .from('platform_payments')
        .select('id')
        .eq('account_id', context.accountId)
        .eq('status', 'captured')
        .eq('is_setup_fee_included', true)
        .limit(1)
        .maybeSingle();
      if (payErr) {
        console.error('[create-order] payment ledger lookup failed:', payErr);
        return NextResponse.json(
          { error: 'Unable to verify billing history. Please try again.' },
          { status: 500 }
        );
      }
      if (paidSetup) setupFeePaid = true;
    }

    const setupFeeIncluded = !setupFeePaid;
    const totalAmountInInr = setupFeeIncluded
      ? targetPlan.setupFee + targetPlan.monthlyPrice
      : targetPlan.monthlyPrice;

    // Integer paise, validated (rejects zero/negative/NaN/absurd values).
    const amountInPaise = assertValidOrderAmountPaise(
      Math.round(totalAmountInInr * 100)
    );

    const receipt = `rcpt_${context.accountId.slice(0, 8)}_${Date.now().toString().slice(-6)}`;

    const order = await createRazorpayOrder({
      amountInPaise,
      currency: targetPlan.currency || 'INR',
      receipt,
      // Server-controlled identifiers only — no PII, no price, no
      // first-time flag. The webhook resolves everything it trusts from
      // billing_orders, not from these echoed notes.
      notes: {
        account_id: context.accountId,
        plan_slug: targetPlan.slug,
        purpose: 'subscription',
      },
    });

    // Persist the server-side order record the webhook verifies against.
    const { error: orderErr } = await db.from('billing_orders').insert({
      account_id: context.accountId,
      razorpay_order_id: order.id,
      plan_slug: targetPlan.slug,
      billing_interval: targetPlan.billingInterval || 'monthly',
      amount_paise: amountInPaise,
      currency: targetPlan.currency || 'INR',
      setup_fee_included: setupFeeIncluded,
      setup_fee_amount: setupFeeIncluded ? targetPlan.setupFee : 0,
      monthly_amount: targetPlan.monthlyPrice,
      status: 'created',
      created_by: context.userId,
    });
    if (orderErr) {
      console.error('[create-order] billing_orders insert failed:', orderErr);
      return NextResponse.json(
        { error: 'Unable to record the payment order. Please try again.' },
        { status: 500 }
      );
    }

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
        isFirstTime: setupFeeIncluded,
        totalAmountInInr,
      },
    });
  } catch (err) {
    if (err instanceof RazorpayConfigurationError) {
      return NextResponse.json(
        { error: 'Payments are not configured. Please contact support.' },
        { status: 503 }
      );
    }
    if (err instanceof InvalidOrderAmountError) {
      return NextResponse.json(
        { error: 'Invalid payment amount for the selected plan.' },
        { status: 400 }
      );
    }
    return toErrorResponse(err);
  }
}
