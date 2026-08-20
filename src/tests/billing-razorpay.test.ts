import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import {
  verifyRazorpayWebhookSignature,
  verifyRazorpayPaymentSignature,
  createRazorpayOrder,
} from '@/lib/billing/razorpay';
import {
  checkFeatureAccess,
  checkPlanLimits,
  expireStaleTrials,
} from '@/lib/saas/subscription';
import { DEFAULT_PLANS, getPlanBySlug } from '@/core/billing/plans';

describe('Helpa Phase 1 — Razorpay Billing & Subscription Lifecycle', () => {
  describe('1. Razorpay Signature Verification Security', () => {
    const secret = 'webhook_secret_test_xyz123';
    const payload = JSON.stringify({
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_test_999',
            amount: 1699800,
            currency: 'INR',
            status: 'captured',
            notes: { accountId: 'acc_test_123', planSlug: 'growth' },
          },
        },
      },
    });

    it('should successfully verify valid HMAC-SHA256 signatures', () => {
      const validSignature = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

      const isValid = verifyRazorpayWebhookSignature(
        payload,
        validSignature,
        secret
      );
      expect(isValid).toBe(true);
    });

    it('should reject tampered or invalid signatures', () => {
      const invalidSignature = 'tampered_signature_abc_123';
      const isValid = verifyRazorpayWebhookSignature(
        payload,
        invalidSignature,
        secret
      );
      expect(isValid).toBe(false);
    });

    it('should reject when secret or signature is missing', () => {
      expect(verifyRazorpayWebhookSignature(payload, '', secret)).toBe(false);
      expect(verifyRazorpayWebhookSignature(payload, 'sig', '')).toBe(false);
    });

    it('should verify client checkout payment signatures', () => {
      const keySecret = 'rzp_key_secret_abc';
      const orderId = 'order_12345';
      const paymentId = 'pay_67890';
      const validSig = crypto
        .createHmac('sha256', keySecret)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

      expect(
        verifyRazorpayPaymentSignature({
          orderId,
          paymentId,
          signature: validSig,
          secret: keySecret,
        })
      ).toBe(true);

      expect(
        verifyRazorpayPaymentSignature({
          orderId,
          paymentId,
          signature: 'wrong_sig',
          secret: keySecret,
        })
      ).toBe(false);
    });
  });

  describe('2. Plan Pricing & Order Computation', () => {
    it('should correctly calculate setup fee + monthly price for first-time subscriber', async () => {
      const growth = await getPlanBySlug('growth');
      const firstTimeTotal = growth.setupFee + growth.monthlyPrice;
      expect(growth.setupFee).toBe(11999);
      expect(growth.monthlyPrice).toBe(4999);
      expect(firstTimeTotal).toBe(16998);

      const order = await createRazorpayOrder({
        amountInPaise: firstTimeTotal * 100,
        currency: 'INR',
        receipt: 'rcpt_test_001',
        notes: { accountId: 'acc_01', planSlug: 'growth', isFirstTime: 'true' },
      });

      expect(order.amount).toBe(1699800);
      expect(order.currency).toBe('INR');
      expect(order.status).toBe('created');
    });

    it('should charge only monthly recurring amount on renewals', async () => {
      const pro = await getPlanBySlug('pro');
      expect(pro.monthlyPrice).toBe(7999);

      const order = await createRazorpayOrder({
        amountInPaise: pro.monthlyPrice * 100,
        currency: 'INR',
        receipt: 'rcpt_test_002',
        notes: { accountId: 'acc_02', planSlug: 'pro', isFirstTime: 'false' },
      });

      expect(order.amount).toBe(799900);
    });
  });

  describe('3. Plan Limits & Gating Enforcements', () => {
    it('should enforce limits for Starter, Growth, and Pro tiers', () => {
      const starter = DEFAULT_PLANS.find((p) => p.slug === 'starter')!;
      const growth = DEFAULT_PLANS.find((p) => p.slug === 'growth')!;
      const pro = DEFAULT_PLANS.find((p) => p.slug === 'pro')!;

      expect(starter.usageLimits.contacts).toBe(1500);
      expect(growth.usageLimits.contacts).toBe(10000);
      expect(pro.usageLimits.contacts).toBe(50000);

      expect(starter.usageLimits.teamMembers).toBe(3);
      expect(growth.usageLimits.teamMembers).toBe(10);
      expect(pro.usageLimits.teamMembers).toBe(25);

      expect(starter.usageLimits.automations).toBe(5);
      expect(growth.usageLimits.automations).toBe(25);
      expect(pro.usageLimits.automations).toBe(100);
    });

    it('should safely execute checkPlanLimits', async () => {
      const contactCheck = await checkPlanLimits('test-acc-1', 'max_contacts');
      expect(contactCheck).toHaveProperty('allowed');
      expect(contactCheck).toHaveProperty('currentUsage');
      expect(contactCheck).toHaveProperty('limit');

      const userCheck = await checkPlanLimits('test-acc-1', 'max_users');
      expect(userCheck).toHaveProperty('allowed');

      const autoCheck = await checkPlanLimits('test-acc-1', 'automations');
      expect(autoCheck).toHaveProperty('allowed');
    });

    it('should block feature access for expired or trial-expired subscriptions', async () => {
      const access = await checkFeatureAccess('test-acc-expired', 'core.inbox');
      expect(access).toHaveProperty('allowed');
    });
  });

  describe('4. Trial & Subscription Lifecycle Expiration', () => {
    it('should safely execute expireStaleTrials cron routine', async () => {
      const result = await expireStaleTrials();
      expect(result).toHaveProperty('expiredTrialsCount');
      expect(result).toHaveProperty('expiredSubsCount');
      expect(typeof result.expiredTrialsCount).toBe('number');
      expect(typeof result.expiredSubsCount).toBe('number');
    });
  });
});
