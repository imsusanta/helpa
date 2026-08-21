import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient as getSupabaseAdminClient } from '@/lib/supabase/server';
import { findPlanBySlug } from '@/core/billing/plans';
import { verifyRazorpayWebhookSignature } from '@/lib/billing/razorpay';

const SUPPORTED_EVENTS = new Set([
  'payment.captured',
  'order.paid',
  'payment.failed',
]);

function errorResponse(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

function validAmount(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
    if (!webhookSecret) {
      console.error('[Razorpay Webhook] RAZORPAY_WEBHOOK_SECRET is missing');
      return errorResponse('Webhook is not configured', 503);
    }

    const signature = request.headers.get('x-razorpay-signature')?.trim();
    if (!signature) return errorResponse('Missing webhook signature', 401);

    const rawBody = await request.text();
    if (!rawBody) return errorResponse('Empty payload received', 400);

    if (!verifyRazorpayWebhookSignature(rawBody, signature, webhookSecret)) {
      console.warn('[Razorpay Webhook] Invalid signature rejected');
      return errorResponse('Invalid webhook signature', 401);
    }

    let payload: Record<string, any>;
    try {
      payload = JSON.parse(rawBody) as Record<string, any>;
    } catch {
      return errorResponse('Invalid JSON payload', 400);
    }

    const event = String(payload.event || '');
    if (!SUPPORTED_EVENTS.has(event)) {
      return NextResponse.json({ received: true, status: 'ignored', event });
    }

    const payment = payload?.payload?.payment?.entity;
    const order = payload?.payload?.order?.entity;
    if (!payment || !payment.id || !payment.order_id) {
      return errorResponse('Payment identity is missing', 400);
    }

    const notes = payment.notes || order?.notes || {};
    const accountId = String(notes.accountId || '').trim();
    const planIdentifier = String(notes.planSlug || '').trim();
    if (!accountId || !planIdentifier) {
      return errorResponse('Payment account or plan metadata is missing', 400);
    }

    const targetPlan = await findPlanBySlug(planIdentifier);
    if (!targetPlan || !targetPlan.isActive) {
      return errorResponse('Payment references an unknown or inactive plan', 400);
    }

    if (!validAmount(payment.amount)) {
      return errorResponse('Payment amount is invalid', 400);
    }

    const paymentId = String(payment.id);
    const orderId = String(payment.order_id);
    const chargedAmount = payment.amount / 100;
    const currency = String(payment.currency || targetPlan.currency || 'INR');
    const isFirstTimeRequested = notes.isFirstTime === 'true';
    const database = getSupabaseAdminClient();

    const { data: account, error: accountError } = await database
      .from('accounts')
      .select('id')
      .eq('id', accountId)
      .maybeSingle();
    if (accountError) throw accountError;
    if (!account) return errorResponse('Payment account was not found', 400);

    const { data: existingPayment, error: paymentLookupError } = await database
      .from('platform_payments')
      .select('id, status')
      .eq('razorpay_payment_id', paymentId)
      .maybeSingle();
    if (paymentLookupError) throw paymentLookupError;

    if (existingPayment?.status === 'captured') {
      return NextResponse.json({
        received: true,
        status: 'already_processed',
      });
    }

    const { data: existingSubscription, error: subscriptionLookupError } =
      await database
        .from('subscriptions')
        .select('id, end_date, setup_fee_paid')
        .eq('account_id', accountId)
        .maybeSingle();
    if (subscriptionLookupError) throw subscriptionLookupError;

    const now = new Date();
    const existingEnd = existingSubscription?.end_date
      ? new Date(existingSubscription.end_date)
      : null;
    const periodStart = now.toISOString();
    const periodBase =
      existingEnd && existingEnd.getTime() > now.getTime() ? existingEnd : now;
    const periodEnd = new Date(
      periodBase.getTime() + 30 * 86400 * 1000
    ).toISOString();

    const includesSetupFee =
      isFirstTimeRequested && !(existingSubscription?.setup_fee_paid ?? false);
    const expectedAmount = includesSetupFee
      ? targetPlan.setupFee + targetPlan.monthlyPrice
      : targetPlan.monthlyPrice;

    if (event !== 'payment.failed' && chargedAmount !== expectedAmount) {
      console.error('[Razorpay Webhook] Amount mismatch', {
        accountId,
        paymentId,
        expectedAmount,
        chargedAmount,
      });
      return errorResponse('Payment amount does not match the selected plan', 422);
    }

    const paymentType = includesSetupFee
      ? 'setup_and_first_month'
      : 'monthly_renewal';

    const { error: pendingPaymentError } = await database
      .from('platform_payments')
      .upsert(
        {
          account_id: accountId,
          subscription_id: existingSubscription?.id || null,
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: signature,
          amount: chargedAmount,
          currency,
          plan_slug: targetPlan.slug,
          payment_type: paymentType,
          status: event === 'payment.failed' ? 'failed' : 'pending',
          is_setup_fee_included: includesSetupFee,
          setup_fee_amount: includesSetupFee ? targetPlan.setupFee : 0,
          monthly_recurring_amount: targetPlan.monthlyPrice,
          period_start: periodStart,
          period_end: periodEnd,
          metadata: {
            gateway: 'razorpay',
            event,
            method: String(payment.method || 'unknown'),
          },
          updated_at: periodStart,
        },
        { onConflict: 'razorpay_payment_id' }
      );
    if (pendingPaymentError) throw pendingPaymentError;

    if (event === 'payment.failed') {
      const { error: failureUpdateError } = await database
        .from('subscriptions')
        .update({ status: 'PAST_DUE', updated_at: periodStart })
        .eq('account_id', accountId);
      if (failureUpdateError) throw failureUpdateError;

      await database.from('audit_logs').insert({
        account_id: accountId,
        action: 'payment.failed',
        target_type: 'subscription',
        metadata: {
          gateway: 'razorpay',
          razorpay_payment_id: paymentId,
          error_code: String(payment.error_code || 'PAYMENT_ERROR'),
          processed_at: periodStart,
        },
      });

      return NextResponse.json({
        received: true,
        status: 'subscription_marked_past_due',
      });
    }

    let subscriptionId = existingSubscription?.id;
    if (existingSubscription) {
      const { error } = await database
        .from('subscriptions')
        .update({
          plan_slug: targetPlan.slug,
          status: 'ACTIVE',
          setup_fee_paid: true,
          setup_fee_amount: targetPlan.setupFee,
          monthly_amount: targetPlan.monthlyPrice,
          currency,
          end_date: periodEnd,
          payment_provider: 'razorpay',
          external_subscription_id: paymentId,
          updated_at: periodStart,
        })
        .eq('id', existingSubscription.id)
        .eq('account_id', accountId);
      if (error) throw error;
    } else {
      const { data: newSubscription, error } = await database
        .from('subscriptions')
        .insert({
          account_id: accountId,
          plan_slug: targetPlan.slug,
          status: 'ACTIVE',
          setup_fee_paid: true,
          setup_fee_amount: targetPlan.setupFee,
          monthly_amount: targetPlan.monthlyPrice,
          currency,
          end_date: periodEnd,
          payment_provider: 'razorpay',
          external_subscription_id: paymentId,
          created_at: periodStart,
          updated_at: periodStart,
        })
        .select('id')
        .single();
      if (error) throw error;
      subscriptionId = newSubscription?.id;
    }

    const { error: captureError } = await database
      .from('platform_payments')
      .update({
        subscription_id: subscriptionId || null,
        status: 'captured',
        updated_at: new Date().toISOString(),
      })
      .eq('razorpay_payment_id', paymentId)
      .eq('account_id', accountId);
    if (captureError) throw captureError;

    const { error: auditError } = await database.from('audit_logs').insert({
      account_id: accountId,
      action: 'payment.captured',
      target_type: 'subscription',
      metadata: {
        gateway: 'razorpay',
        razorpay_payment_id: paymentId,
        razorpay_order_id: orderId,
        amount: chargedAmount,
        currency,
        plan_slug: targetPlan.slug,
        payment_type: paymentType,
        new_end_date: periodEnd,
        processed_at: new Date().toISOString(),
      },
    });
    if (auditError) throw auditError;

    return NextResponse.json({
      received: true,
      status: 'subscription_activated',
      plan: targetPlan.slug,
      new_end_date: periodEnd,
    });
  } catch (error) {
    console.error(
      '[Razorpay Webhook] Processing failed:',
      error instanceof Error ? error.message : String(error)
    );
    return errorResponse('Webhook processing failed', 500);
  }
}
