import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient as getSupabaseAdminClient } from '@/lib/supabase/server';
import { findPlanBySlug } from '@/core/billing/plans';
import { verifyRazorpayWebhookSignature } from '@/lib/billing/razorpay';

/**
 * POST /api/webhooks/razorpay — the single production payment webhook.
 *
 * Pipeline (fail-closed at every step):
 * 1. Raw body is read before JSON parsing; RAZORPAY_WEBHOOK_SECRET is
 *    required (503 when missing) and x-razorpay-signature is verified
 *    before any payload field is trusted (400 on mismatch).
 * 2. Only payment.captured, order.paid, and payment.failed are handled;
 *    other events are acknowledged and ignored.
 * 3. Events without stable provider identity (payment id + order id) are
 *    logged and safely ignored — no Date.now()-based ids are ever minted.
 * 4. Account, plan, and the expected charge are resolved from the
 *    server-created billing_orders record (fallback: server-set order
 *    notes for account/plan identity only, with the price recomputed from
 *    the plan catalog and persisted setup-fee state — notes are never
 *    trusted for price or first-payment status).
 * 5. Currency and captured amount must match the server-side expectation
 *    or the subscription is not activated.
 * 6. The state change is applied by an atomic PostgreSQL RPC
 *    (billing_apply_payment_captured / billing_apply_payment_failed) that
 *    locks state, rejects duplicates by razorpay_payment_id, updates the
 *    subscription, writes platform_payments and the audit log, and mirrors
 *    accounts.* in one transaction. Any database failure returns 500 so
 *    Razorpay retries.
 */

interface PaymentEntity {
  id?: unknown;
  order_id?: unknown;
  amount?: unknown;
  currency?: unknown;
  status?: unknown;
  error_code?: unknown;
  error_description?: unknown;
  notes?: Record<string, unknown>;
}

interface ResolvedOrderContext {
  accountId: string;
  planSlug: string;
  billingInterval: 'monthly' | 'yearly';
  expectedAmountPaise: number;
  expectedCurrency: string;
  setupFeeIncluded: boolean;
  setupFeeAmount: number;
  monthlyAmount: number;
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const signature = request.headers.get('x-razorpay-signature') || '';
    const rawBody = await request.text();

    if (!rawBody) {
      return NextResponse.json(
        { error: 'Empty payload received' },
        { status: 400 }
      );
    }

    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error(
        '[Razorpay Webhook] RAZORPAY_WEBHOOK_SECRET is not configured'
      );
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 503 }
      );
    }

    const isValid = verifyRazorpayWebhookSignature(
      rawBody,
      signature,
      webhookSecret
    );
    if (!isValid) {
      console.warn('[Razorpay Webhook] Invalid signature rejected');
      return NextResponse.json(
        { error: 'Invalid webhook signature' },
        { status: 400 }
      );
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Malformed JSON' }, { status: 400 });
    }

    const event = asNonEmptyString(payload?.event);
    const handledEvents = ['payment.captured', 'order.paid', 'payment.failed'];
    if (!event || !handledEvents.includes(event)) {
      return NextResponse.json({ received: true, event: event || 'unknown' });
    }

    const payloadBody = (payload?.payload ?? {}) as Record<
      string,
      { entity?: unknown } | undefined
    >;
    const payment = (payloadBody.payment?.entity ??
      null) as PaymentEntity | null;
    const orderEntity = (payloadBody.order?.entity ?? null) as {
      id?: unknown;
      notes?: Record<string, unknown>;
    } | null;

    const paymentId = asNonEmptyString(payment?.id);
    const orderId =
      asNonEmptyString(payment?.order_id) ?? asNonEmptyString(orderEntity?.id);

    if (!paymentId || !orderId) {
      // Stable provider identity is mandatory; without it the event cannot
      // be processed idempotently. Acknowledge so Razorpay stops retrying
      // an event that can never become valid.
      console.warn(
        '[Razorpay Webhook] Ignoring event without payment/order identity:',
        event
      );
      return NextResponse.json({
        received: true,
        status: 'ignored_missing_identity',
      });
    }

    const supabase = getSupabaseAdminClient();

    // ---- Resolve the server-side order context -------------------------
    const { data: orderRow, error: orderErr } = await supabase
      .from('billing_orders')
      .select(
        'account_id, plan_slug, billing_interval, amount_paise, currency, setup_fee_included, setup_fee_amount, monthly_amount'
      )
      .eq('razorpay_order_id', orderId)
      .maybeSingle();
    if (orderErr) {
      console.error('[Razorpay Webhook] Order lookup failed:', orderErr);
      return NextResponse.json(
        { error: 'Order lookup failed' },
        { status: 500 }
      );
    }

    let ctx: ResolvedOrderContext | null = null;

    if (orderRow) {
      ctx = {
        accountId: String(orderRow.account_id),
        planSlug: String(orderRow.plan_slug),
        billingInterval:
          orderRow.billing_interval === 'yearly' ? 'yearly' : 'monthly',
        expectedAmountPaise: Number(orderRow.amount_paise),
        expectedCurrency: String(orderRow.currency || 'INR'),
        setupFeeIncluded: orderRow.setup_fee_included === true,
        setupFeeAmount: Number(orderRow.setup_fee_amount || 0),
        monthlyAmount: Number(orderRow.monthly_amount || 0),
      };
    } else {
      // Legacy fallback for orders created before billing_orders existed.
      // Notes were written server-side at order creation and the payload
      // signature has been verified — but the price and first-payment flag
      // are still recomputed from persisted data, never read from notes.
      const notes = {
        ...(orderEntity?.notes || {}),
        ...(payment?.notes || {}),
      } as Record<string, unknown>;
      const notesAccountId =
        asNonEmptyString(notes.account_id) ?? asNonEmptyString(notes.accountId);
      const notesPlanSlug =
        asNonEmptyString(notes.plan_slug) ?? asNonEmptyString(notes.planSlug);

      if (!notesAccountId || !UUID_RE.test(notesAccountId) || !notesPlanSlug) {
        console.warn(
          '[Razorpay Webhook] Ignoring event without resolvable order context:',
          event
        );
        return NextResponse.json({
          received: true,
          status: 'ignored_unresolvable_order',
        });
      }

      const plan = await findPlanBySlug(notesPlanSlug);
      if (!plan || !plan.isActive) {
        console.warn(
          '[Razorpay Webhook] Ignoring event for unknown/inactive plan'
        );
        return NextResponse.json({
          received: true,
          status: 'ignored_unknown_plan',
        });
      }

      const { data: subRow, error: subErr } = await supabase
        .from('subscriptions')
        .select('setup_fee_paid')
        .eq('account_id', notesAccountId)
        .maybeSingle();
      if (subErr) {
        console.error('[Razorpay Webhook] Subscription lookup failed:', subErr);
        return NextResponse.json(
          { error: 'Subscription lookup failed' },
          { status: 500 }
        );
      }

      const setupFeeIncluded = !(subRow?.setup_fee_paid === true);
      ctx = {
        accountId: notesAccountId,
        planSlug: plan.slug,
        billingInterval:
          plan.billingInterval === 'yearly' ? 'yearly' : 'monthly',
        expectedAmountPaise: Math.round(
          (setupFeeIncluded
            ? plan.setupFee + plan.monthlyPrice
            : plan.monthlyPrice) * 100
        ),
        expectedCurrency: plan.currency || 'INR',
        setupFeeIncluded,
        setupFeeAmount: setupFeeIncluded ? plan.setupFee : 0,
        monthlyAmount: plan.monthlyPrice,
      };
    }

    // The plan must still be active in the catalog at processing time.
    const catalogPlan = await findPlanBySlug(ctx.planSlug);
    if (!catalogPlan || !catalogPlan.isActive) {
      console.error(
        '[Razorpay Webhook] Plan is no longer active; not activating subscription'
      );
      return NextResponse.json({
        received: true,
        status: 'ignored_inactive_plan',
      });
    }

    // ---- payment.captured / order.paid ---------------------------------
    if (event === 'payment.captured' || event === 'order.paid') {
      const capturedAmountPaise = Number(payment?.amount);
      const capturedCurrency = asNonEmptyString(payment?.currency) || 'INR';

      const amountMatches =
        Number.isSafeInteger(capturedAmountPaise) &&
        capturedAmountPaise === ctx.expectedAmountPaise;
      const currencyMatches =
        capturedCurrency.toUpperCase() === ctx.expectedCurrency.toUpperCase();

      if (!amountMatches || !currencyMatches) {
        // Real money may have moved, but the charge does not match what the
        // server priced: never activate. Surface for manual reconciliation.
        console.error(
          '[Razorpay Webhook] Amount/currency mismatch; subscription NOT activated',
          {
            orderId,
            expectedAmountPaise: ctx.expectedAmountPaise,
            capturedAmountPaise,
            expectedCurrency: ctx.expectedCurrency,
            capturedCurrency,
          }
        );
        const { error: auditErr } = await supabase.from('audit_logs').insert({
          account_id: ctx.accountId,
          action: 'billing.payment_amount_mismatch',
          target_type: 'subscription',
          metadata: {
            gateway: 'razorpay',
            razorpay_payment_id: paymentId,
            razorpay_order_id: orderId,
            expected_amount_paise: ctx.expectedAmountPaise,
            captured_amount_paise: capturedAmountPaise,
            expected_currency: ctx.expectedCurrency,
            captured_currency: capturedCurrency,
          },
        });
        if (auditErr) {
          console.error(
            '[Razorpay Webhook] Mismatch audit insert failed:',
            auditErr
          );
          return NextResponse.json(
            { error: 'Failed to record mismatch' },
            { status: 500 }
          );
        }
        return NextResponse.json({
          received: true,
          status: 'amount_mismatch_not_activated',
        });
      }

      const { data: rpcData, error: rpcError } = await supabase.rpc(
        'billing_apply_payment_captured',
        {
          p_account_id: ctx.accountId,
          p_order_id: orderId,
          p_payment_id: paymentId,
          p_plan_slug: ctx.planSlug,
          p_amount_paise: ctx.expectedAmountPaise,
          p_currency: ctx.expectedCurrency,
          p_setup_fee_included: ctx.setupFeeIncluded,
          p_setup_fee_amount: ctx.setupFeeAmount,
          p_monthly_amount: ctx.monthlyAmount,
          p_billing_interval: ctx.billingInterval,
          p_signature: signature,
          p_event: event,
        }
      );

      if (rpcError) {
        console.error(
          '[Razorpay Webhook] billing_apply_payment_captured failed:',
          rpcError
        );
        // 500 → Razorpay retries; nothing was committed.
        return NextResponse.json(
          { error: 'Payment processing failed' },
          { status: 500 }
        );
      }

      const result = (rpcData ?? {}) as {
        status?: string;
        period_end?: string;
      };
      if (result.status === 'already_processed') {
        return NextResponse.json({
          received: true,
          status: 'already_processed',
        });
      }

      return NextResponse.json({
        received: true,
        status: 'subscription_activated',
        plan: ctx.planSlug,
        new_end_date: result.period_end,
      });
    }

    // ---- payment.failed -------------------------------------------------
    if (event === 'payment.failed') {
      const failedAmountPaise = Number(payment?.amount);
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        'billing_apply_payment_failed',
        {
          p_account_id: ctx.accountId,
          p_order_id: orderId,
          p_payment_id: paymentId,
          p_plan_slug: ctx.planSlug,
          p_amount_paise: Number.isSafeInteger(failedAmountPaise)
            ? failedAmountPaise
            : 0,
          p_currency: ctx.expectedCurrency,
          p_error_code:
            asNonEmptyString(payment?.error_code) || 'PAYMENT_ERROR',
          p_error_description:
            asNonEmptyString(payment?.error_description) ||
            'Payment failed at gateway',
          p_grace_days: 3,
        }
      );

      if (rpcError) {
        console.error(
          '[Razorpay Webhook] billing_apply_payment_failed failed:',
          rpcError
        );
        return NextResponse.json(
          { error: 'Payment failure processing failed' },
          { status: 500 }
        );
      }

      const result = (rpcData ?? {}) as { status?: string };
      if (result.status === 'already_processed') {
        return NextResponse.json({
          received: true,
          status: 'already_processed',
        });
      }

      return NextResponse.json({
        received: true,
        status: 'subscription_marked_past_due',
      });
    }

    return NextResponse.json({ received: true, event });
  } catch (err: unknown) {
    // Never leak internals; a 500 makes Razorpay retry the delivery.
    console.error('[Razorpay Webhook Error]:', err);
    return NextResponse.json(
      { error: 'Webhook processing failure' },
      { status: 500 }
    );
  }
}
