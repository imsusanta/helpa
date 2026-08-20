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
    const paymentId = payment?.id || order?.id || `pay_${Date.now()}`;

    // 1. Idempotency Check: Don't process the same payment capture twice
    const { data: existingLog } = await supabase
      .from('audit_logs')
      .select('id')
      .eq('account_id', accountId)
      .eq('action', 'payment.captured')
      .filter('metadata->>razorpay_payment_id', 'eq', paymentId)
      .maybeSingle();

    if (existingLog) {
      return NextResponse.json({
        received: true,
        status: 'already_processed',
      });
    }

    // 2. Handle Payment Success
    if (event === 'payment.captured' || event === 'order.paid') {
      const targetPlan = await getPlanBySlug(planSlug);
      const nextEndDate = new Date(
        Date.now() + 30 * 86400 * 1000
      ).toISOString();

      // Check for existing subscription row
      const { data: existingSub } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('account_id', accountId)
        .maybeSingle();

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
        await supabase.from('subscriptions').insert({
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
        });
      }

      // Record in Audit Logs for permanent payment transaction history
      await supabase.from('audit_logs').insert({
        account_id: accountId,
        action: 'payment.captured',
        target_type: 'subscription',
        metadata: {
          gateway: 'razorpay',
          razorpay_payment_id: paymentId,
          razorpay_order_id: payment?.order_id || order?.id || '',
          amount: payment?.amount
            ? payment.amount / 100
            : targetPlan.monthlyPrice,
          currency: payment?.currency || targetPlan.currency || 'INR',
          plan_slug: targetPlan.slug,
          is_first_time: isFirstTime,
          processed_at: new Date().toISOString(),
        },
      });

      return NextResponse.json({
        received: true,
        status: 'subscription_activated',
        plan: targetPlan.slug,
      });
    }

    // 3. Handle Payment Failure
    if (event === 'payment.failed') {
      await supabase
        .from('subscriptions')
        .update({
          status: 'PAST_DUE',
          updated_at: new Date().toISOString(),
        })
        .eq('account_id', accountId);

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
