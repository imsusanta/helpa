/**
 * Helpa Core SaaS Billing — Internal Billing Event Processing
 *
 * @deprecated for provider webhooks. The single production webhook path is
 * POST /api/webhooks/razorpay, which verifies the provider signature and
 * applies the payment atomically via the billing_apply_payment_* RPCs.
 * This module only serves internal, already-trusted billing events (and
 * their tests); it performs no signature verification and must never be
 * exposed on a public route.
 */

import { getAdminClient } from '@/lib/db/server';
import {
  upgradeSubscription,
  handlePaymentFailure,
  cancelSubscription,
} from './subscription.service';
import { PaymentRecord } from './types';
import { coreEvents } from '@/core/events';

export interface WebhookEventPayload {
  eventId: string;
  eventType:
    | 'payment.succeeded'
    | 'payment.failed'
    | 'subscription.activated'
    | 'subscription.cancelled'
    | 'subscription.renewed';
  workspaceId: string;
  planId?: string;
  amount?: number;
  currency?: string;
  paymentId?: string;
  timestamp: string;
  signature?: string;
}

/**
 * Handles incoming payment provider webhooks idempotently.
 */
export async function processPaymentWebhook(
  payload: WebhookEventPayload
): Promise<{ success: boolean; duplicate: boolean; message: string }> {
  const db = getAdminClient();

  // 1. Idempotency check: verify if eventId was already processed
  const { data: existing } = await db
    .from('audit_logs')
    .select('id')
    .eq('action', `webhook:${payload.eventId}`)
    .maybeSingle();

  if (existing) {
    return {
      success: true,
      duplicate: true,
      message: `Webhook event ${payload.eventId} was already processed.`,
    };
  }

  // 2. Dispatch event based on event type
  switch (payload.eventType) {
    case 'payment.succeeded':
    case 'subscription.activated': {
      if (payload.planId) {
        await upgradeSubscription({
          workspaceId: payload.workspaceId,
          newPlanId: payload.planId,
          externalCustomerId: `cust_${payload.workspaceId}`,
          externalSubscriptionId: payload.paymentId,
        });
      }

      // The canonical SaaS payment ledger is platform_payments, written by
      // the Razorpay webhook's atomic RPC. This internal event processor
      // must not double-book payments into hospital_bills (clinical
      // billing) or any secondary ledger.
      const paymentRecord: PaymentRecord = {
        id: payload.eventId,
        workspaceId: payload.workspaceId,
        subscriptionId: `sub-${payload.workspaceId}`,
        amount: payload.amount || 0,
        currency: payload.currency || 'INR',
        status: 'Paid',
        provider: 'Razorpay',
        providerPaymentId: payload.paymentId || payload.eventId,
        date: payload.timestamp || new Date().toISOString(),
      };

      coreEvents.emit(
        'billing.payment_succeeded',
        payload.workspaceId,
        paymentRecord
      );
      break;
    }

    case 'payment.failed': {
      await handlePaymentFailure(payload.workspaceId);
      break;
    }

    case 'subscription.cancelled': {
      await cancelSubscription({
        workspaceId: payload.workspaceId,
        cancelImmediately: true,
      });
      break;
    }

    case 'subscription.renewed': {
      if (payload.planId) {
        await upgradeSubscription({
          workspaceId: payload.workspaceId,
          newPlanId: payload.planId,
        });
      }
      break;
    }
  }

  // 3. Mark event as processed in audit log for idempotency
  await db.from('audit_logs').insert({
    account_id: payload.workspaceId,
    action: `webhook:${payload.eventId}`,
    details: {
      eventType: payload.eventType,
      amount: payload.amount,
      processedAt: new Date().toISOString(),
    },
    created_at: new Date().toISOString(),
  });

  return {
    success: true,
    duplicate: false,
    message: `Webhook event ${payload.eventType} processed successfully.`,
  };
}
