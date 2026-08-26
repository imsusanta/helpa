import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient as getSupabaseAdminClient } from '@/lib/supabase/server';
import { getPlanBySlug, resolvePlanRowId } from '@/core/billing/plans';
import { verifyRazorpayWebhookSignature } from '@/lib/billing/razorpay';

/** How long a 'pending' claim is honored before a retry may take over. */
const CLAIM_TAKEOVER_MS = 10 * 60 * 1000;

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

    const payload = JSON.parse(rawBody);
    const event = payload?.event;
    const payment = payload?.payload?.payment?.entity;
    const order = payload?.payload?.order?.entity;

    const notes = payment?.notes || order?.notes || {};
    const accountId = notes.accountId;
    const planSlug = notes.planSlug || 'growth';
    const isFirstTime = notes.isFirstTime === 'true';

    if (!accountId) {
      console.warn(
        '[Razorpay Webhook] Missing accountId in payment notes, event ignored:',
        event
      );
      return NextResponse.json({
        received: true,
        message: 'No accountId in notes',
      });
    }

    const supabase = getSupabaseAdminClient();

    // Stable idempotency subject. `payment.captured` and `order.paid`
    // fire for the same payment; both must resolve to the same key so
    // one payment can never be applied twice. Never fall back to a
    // timestamp — that would defeat deduplication entirely.
    const rawPaymentId =
      typeof payment?.id === 'string' && payment.id ? payment.id : null;
    const rawOrderId = payment?.order_id || order?.id || null;
    const paymentId =
      rawPaymentId || (rawOrderId ? `order_${rawOrderId}` : null);
    if (!paymentId) {
      console.warn(
        '[Razorpay Webhook] Event carries neither payment id nor order id, ignored:',
        event
      );
      return NextResponse.json({ received: true, message: 'No payment id' });
    }
    const orderId = rawOrderId || `order_for_${paymentId}`;

    // 2. Handle Payment Success (Captured / Order Paid)
    if (event === 'payment.captured' || event === 'order.paid') {
      const targetPlan = await getPlanBySlug(planSlug);
      const nowIso = new Date().toISOString();

      const claimedAmount = payment?.amount
        ? payment.amount / 100
        : isFirstTime
          ? targetPlan.setupFee + targetPlan.monthlyPrice
          : targetPlan.monthlyPrice;

      // 1. Atomic idempotency claim: INSERT the payment row first. The
      //    unique constraint on razorpay_payment_id makes exactly one
      //    concurrent delivery win; the check-then-act SELECT this
      //    replaces allowed `payment.captured` + `order.paid` to both
      //    extend the subscription (double entitlement per payment).
      const { error: claimError } = await supabase
        .from('platform_payments')
        .insert({
          account_id: accountId,
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: signature || null,
          amount: claimedAmount,
          currency: payment?.currency || targetPlan.currency || 'INR',
          plan_slug: targetPlan.slug,
          payment_type: 'monthly_renewal',
          status: 'pending',
          period_start: nowIso,
          period_end: nowIso,
          metadata: { gateway: 'razorpay', event, claim: true },
        });

      if (claimError) {
        const isConflict =
          claimError.code === '23505' ||
          /duplicate|unique/i.test(claimError.message || '');
        if (!isConflict) {
          console.error('[Razorpay Webhook] Claim insert failed:', claimError);
          return NextResponse.json(
            { error: 'Failed to record payment' },
            { status: 500 }
          );
        }

        // Someone already holds (or held) this payment/order.
        const { data: byPayment } = await supabase
          .from('platform_payments')
          .select('id, status, updated_at, razorpay_order_id')
          .eq('razorpay_payment_id', paymentId)
          .maybeSingle();

        if (byPayment) {
          if (byPayment.status === 'captured') {
            return NextResponse.json({
              received: true,
              status: 'already_processed',
            });
          }
          const claimAgeMs =
            Date.now() - new Date(byPayment.updated_at || 0).getTime();
          if (
            byPayment.status === 'pending' &&
            claimAgeMs < CLAIM_TAKEOVER_MS
          ) {
            // A concurrent delivery is processing this payment right
            // now. Non-2xx makes Razorpay retry later, when the winner
            // will have marked the row 'captured'.
            return NextResponse.json(
              { received: true, status: 'processing_in_progress' },
              { status: 409 }
            );
          }
          // Stale claim (crashed run) or previously failed row: take over.
        } else {
          // The conflict came from the order-id unique constraint: a
          // different payment attempt for this order already has a row
          // (e.g. a failed attempt before this captured one). Take the
          // row over for the captured payment.
          const { data: byOrder } = await supabase
            .from('platform_payments')
            .select('id, status')
            .eq('razorpay_order_id', orderId)
            .maybeSingle();

          if (byOrder?.status === 'captured') {
            return NextResponse.json({
              received: true,
              status: 'already_processed',
            });
          }
          if (byOrder) {
            const { error: takeoverErr } = await supabase
              .from('platform_payments')
              .update({
                razorpay_payment_id: paymentId,
                status: 'pending',
                updated_at: nowIso,
              })
              .eq('id', byOrder.id);
            if (takeoverErr) {
              console.error(
                '[Razorpay Webhook] Order row takeover failed:',
                takeoverErr
              );
              return NextResponse.json(
                { error: 'Failed to record payment' },
                { status: 500 }
              );
            }
          } else {
            return NextResponse.json(
              { received: true, status: 'processing_in_progress' },
              { status: 409 }
            );
          }
        }
      }

      // Check for existing subscription row
      const { data: existingSub } = await supabase
        .from('subscriptions')
        .select('id, end_date, status')
        .eq('account_id', accountId)
        .maybeSingle();

      // Safe 30-Day Date Rollover Calculation:
      // If renewed before expiry, add 30 days to existing end_date. Otherwise, add 30 days to now.
      const now = Date.now();
      let nextEndDate: string;
      const existingEndDateMs = existingSub?.end_date
        ? new Date(existingSub.end_date).getTime()
        : 0;

      if (existingEndDateMs > now && existingSub?.status === 'active') {
        // Active prepaid subscription renewed early: preserve remaining days + 30 days
        nextEndDate = new Date(
          existingEndDateMs + 30 * 86400 * 1000
        ).toISOString();
      } else {
        // Expired, trial, or new subscription: 30 days from today
        nextEndDate = new Date(now + 30 * 86400 * 1000).toISOString();
      }

      const isReallyFirstTime = isFirstTime;
      const chargedAmount = claimedAmount;
      const paymentType = isReallyFirstTime
        ? 'setup_and_first_month'
        : 'monthly_renewal';

      // Update or Create Subscription using the real schema:
      // (account_id, plan_id, status enum, start_date, end_date).
      const planRowId = await resolvePlanRowId(targetPlan);
      let subscriptionId = existingSub?.id;
      if (existingSub) {
        const { error: subErr } = await supabase
          .from('subscriptions')
          .update({
            status: 'active',
            end_date: nextEndDate,
            updated_at: nowIso,
            ...(planRowId ? { plan_id: planRowId } : {}),
          })
          .eq('id', existingSub.id);
        if (subErr) {
          console.error(
            '[Razorpay Webhook] Subscription update failed:',
            subErr
          );
        }
      } else if (planRowId) {
        const { data: newSub, error: subErr } = await supabase
          .from('subscriptions')
          .insert({
            account_id: accountId,
            plan_id: planRowId,
            status: 'active',
            start_date: nowIso,
            end_date: nextEndDate,
          })
          .select('id')
          .single();
        if (subErr) {
          console.error(
            '[Razorpay Webhook] Subscription insert failed:',
            subErr
          );
        }
        subscriptionId = newSub?.id;
      } else {
        console.error(
          '[Razorpay Webhook] No plans row found for slug:',
          targetPlan.slug
        );
      }

      // Finalize the payment row (with database-level unique constraint)
      await supabase.from('platform_payments').upsert(
        {
          account_id: accountId,
          subscription_id: subscriptionId || null,
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: signature || null,
          amount: chargedAmount,
          currency: payment?.currency || targetPlan.currency || 'INR',
          plan_slug: targetPlan.slug,
          payment_type: paymentType,
          status: 'captured',
          is_setup_fee_included: isReallyFirstTime,
          setup_fee_amount: isReallyFirstTime ? targetPlan.setupFee : 0,
          monthly_recurring_amount: targetPlan.monthlyPrice,
          period_start: nowIso,
          period_end: nextEndDate,
          metadata: {
            gateway: 'razorpay',
            event,
            method: payment?.method || 'unknown',
            email: payment?.email || '',
            contact: payment?.contact || '',
          },
          updated_at: nowIso,
        },
        { onConflict: 'razorpay_payment_id' }
      );

      // Record in Audit Logs for operational audit trail
      await supabase.from('audit_logs').insert({
        account_id: accountId,
        action: 'payment.captured',
        target_type: 'subscription',
        metadata: {
          gateway: 'razorpay',
          razorpay_payment_id: paymentId,
          razorpay_order_id: orderId,
          amount: chargedAmount,
          currency: payment?.currency || targetPlan.currency || 'INR',
          plan_slug: targetPlan.slug,
          payment_type: paymentType,
          new_end_date: nextEndDate,
          processed_at: nowIso,
        },
      });

      return NextResponse.json({
        received: true,
        status: 'subscription_activated',
        plan: targetPlan.slug,
        new_end_date: nextEndDate,
      });
    }

    // 3. Handle Payment Failure. The subscription status is left
    //    untouched: a failed renewal attempt does not revoke the period
    //    that is already paid for, and lapsed periods are expired by the
    //    subscription-lifecycle cron based on end_date.
    if (event === 'payment.failed') {
      const targetPlan = await getPlanBySlug(planSlug);

      await supabase.from('platform_payments').upsert(
        {
          account_id: accountId,
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentId,
          amount: payment?.amount
            ? payment.amount / 100
            : targetPlan.monthlyPrice,
          currency: payment?.currency || targetPlan.currency || 'INR',
          plan_slug: targetPlan.slug,
          payment_type: 'monthly_renewal',
          status: 'failed',
          period_start: new Date().toISOString(),
          period_end: new Date().toISOString(),
          metadata: {
            gateway: 'razorpay',
            event,
            reason: payment?.error_description || 'Payment failed at gateway',
            error_code: payment?.error_code || 'PAYMENT_ERROR',
          },
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'razorpay_payment_id' }
      );

      await supabase.from('audit_logs').insert({
        account_id: accountId,
        action: 'payment.failed',
        target_type: 'subscription',
        metadata: {
          gateway: 'razorpay',
          razorpay_payment_id: paymentId,
          reason: payment?.error_description || 'Payment failed at gateway',
          error_code: payment?.error_code || 'PAYMENT_ERROR',
          processed_at: new Date().toISOString(),
        },
      });

      return NextResponse.json({
        received: true,
        status: 'payment_failure_recorded',
      });
    }

    return NextResponse.json({
      received: true,
      event,
    });
  } catch (err: unknown) {
    console.error('[Razorpay Webhook Error]:', err);
    const message =
      err instanceof Error ? err.message : 'Webhook processing failure';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
