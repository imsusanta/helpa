import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient as getSupabaseAdminClient } from '@/lib/supabase/server';
import { getPlanBySlug } from '@/core/billing/plans';
import { verifyRazorpayWebhookSignature } from '@/lib/billing/razorpay';

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

    // Verify HMAC-SHA256 signature if webhook secret is configured
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (webhookSecret) {
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
    const paymentId = payment?.id || `pay_mock_${Date.now()}`;
    const orderId =
      payment?.order_id || order?.id || `order_mock_${Date.now()}`;

    // 1. Database-Level Idempotency Check: Query platform_payments for unique payment ID
    const { data: existingPayment } = await supabase
      .from('platform_payments')
      .select('id, status')
      .eq('razorpay_payment_id', paymentId)
      .maybeSingle();

    if (existingPayment && existingPayment.status === 'captured') {
      return NextResponse.json({
        received: true,
        status: 'already_processed',
      });
    }

    // 2. Handle Payment Success (Captured / Order Paid)
    if (event === 'payment.captured' || event === 'order.paid') {
      const targetPlan = await getPlanBySlug(planSlug);

      // Check for existing subscription row
      const { data: existingSub } = await supabase
        .from('subscriptions')
        .select('id, end_date, setup_fee_paid')
        .eq('account_id', accountId)
        .maybeSingle();

      // Safe 30-Day Date Rollover Calculation:
      // If renewed before expiry, add 30 days to existing end_date. Otherwise, add 30 days to now.
      const now = Date.now();
      let nextEndDate: string;
      const existingEndDateMs = existingSub?.end_date
        ? new Date(existingSub.end_date).getTime()
        : 0;

      if (existingEndDateMs > now) {
        // Active prepaid subscription renewed early: preserve remaining days + 30 days
        nextEndDate = new Date(
          existingEndDateMs + 30 * 86400 * 1000
        ).toISOString();
      } else {
        // Expired or new subscription: 30 days from today
        nextEndDate = new Date(now + 30 * 86400 * 1000).toISOString();
      }

      const isReallyFirstTime =
        isFirstTime && !(existingSub?.setup_fee_paid ?? false);
      const chargedAmount = payment?.amount
        ? payment.amount / 100
        : isReallyFirstTime
          ? targetPlan.setupFee + targetPlan.monthlyPrice
          : targetPlan.monthlyPrice;

      const paymentType = isReallyFirstTime
        ? 'setup_and_first_month'
        : 'monthly_renewal';

      // Update or Create Subscription in database
      let subscriptionId = existingSub?.id;
      if (existingSub) {
        await supabase
          .from('subscriptions')
          .update({
            plan_slug: targetPlan.slug,
            status: 'ACTIVE',
            setup_fee_paid: true,
            setup_fee_amount: targetPlan.setupFee,
            monthly_amount: targetPlan.monthlyPrice,
            currency: targetPlan.currency || 'INR',
            end_date: nextEndDate,
            payment_provider: 'razorpay',
            external_subscription_id: paymentId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingSub.id);
      } else {
        const { data: newSub } = await supabase
          .from('subscriptions')
          .insert({
            account_id: accountId,
            plan_slug: targetPlan.slug,
            status: 'ACTIVE',
            setup_fee_paid: true,
            setup_fee_amount: targetPlan.setupFee,
            monthly_amount: targetPlan.monthlyPrice,
            currency: targetPlan.currency || 'INR',
            end_date: nextEndDate,
            payment_provider: 'razorpay',
            external_subscription_id: paymentId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select('id')
          .single();
        subscriptionId = newSub?.id;
      }

      // Record in platform_payments table (with database-level unique constraint)
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
          period_start: new Date().toISOString(),
          period_end: nextEndDate,
          metadata: {
            gateway: 'razorpay',
            event,
            method: payment?.method || 'unknown',
            email: payment?.email || '',
            contact: payment?.contact || '',
          },
          updated_at: new Date().toISOString(),
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
          processed_at: new Date().toISOString(),
        },
      });

      return NextResponse.json({
        received: true,
        status: 'subscription_activated',
        plan: targetPlan.slug,
        new_end_date: nextEndDate,
      });
    }

    // 3. Handle Payment Failure
    if (event === 'payment.failed') {
      const targetPlan = await getPlanBySlug(planSlug);

      await supabase
        .from('subscriptions')
        .update({
          status: 'PAST_DUE',
          updated_at: new Date().toISOString(),
        })
        .eq('account_id', accountId);

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
        status: 'subscription_marked_past_due',
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
