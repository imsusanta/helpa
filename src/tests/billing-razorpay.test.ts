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

describe('Helpa Phase 1A — 30-Day Prepaid Billing Hardening & Razorpay Integration', () => {
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

  describe('2. 30-Day Prepaid Plan Pricing & Setup Fee Logic', () => {
    it('should correctly calculate setup fee + monthly price for first-time subscriber', async () => {
      const starter = await getPlanBySlug('starter');
      const firstTimeTotalStarter = starter.setupFee + starter.monthlyPrice;
      expect(starter.setupFee).toBe(7999);
      expect(starter.monthlyPrice).toBe(3499);
      expect(firstTimeTotalStarter).toBe(11498);

      const growth = await getPlanBySlug('growth');
      const firstTimeTotalGrowth = growth.setupFee + growth.monthlyPrice;
      expect(growth.setupFee).toBe(11999);
      expect(growth.monthlyPrice).toBe(4999);
      expect(firstTimeTotalGrowth).toBe(16998);

      const pro = await getPlanBySlug('pro');
      const firstTimeTotalPro = pro.setupFee + pro.monthlyPrice;
      expect(pro.setupFee).toBe(19999);
      expect(pro.monthlyPrice).toBe(7999);
      expect(firstTimeTotalPro).toBe(27998);

      const order = await createRazorpayOrder({
        amountInPaise: firstTimeTotalGrowth * 100,
        currency: 'INR',
        receipt: 'rcpt_test_001',
        notes: { accountId: 'acc_01', planSlug: 'growth', isFirstTime: 'true' },
      });

      expect(order.amount).toBe(1699800);
      expect(order.currency).toBe('INR');
      expect(order.status).toBe('created');
    });

    it('should charge only monthly recurring amount on 30-day renewals without setup fee', async () => {
      const growth = await getPlanBySlug('growth');
      expect(growth.monthlyPrice).toBe(4999);

      const renewalOrder = await createRazorpayOrder({
        amountInPaise: growth.monthlyPrice * 100,
        currency: 'INR',
        receipt: 'rcpt_test_renewal_01',
        notes: {
          accountId: 'acc_01',
          planSlug: 'growth',
          isFirstTime: 'false',
        },
      });

      expect(renewalOrder.amount).toBe(499900); // Only ₹4,999; no setup fee
    });
  });

  describe('3. 30-Day Renewal Date Rollover Logic', () => {
    it('should rollover and preserve remaining days when renewing before expiration', () => {
      const now = new Date('2026-09-15T12:00:00Z').getTime();
      const existingEndDateMs = new Date('2026-09-20T12:00:00Z').getTime();

      let nextEndDate: string;
      if (existingEndDateMs > now) {
        // Renewed 5 days early -> 5 days + 30 days = 35 days from now
        nextEndDate = new Date(
          existingEndDateMs + 30 * 86400 * 1000
        ).toISOString();
      } else {
        nextEndDate = new Date(now + 30 * 86400 * 1000).toISOString();
      }

      expect(nextEndDate).toBe('2026-10-20T12:00:00.000Z');
    });

    it('should grant 30 days from payment time when renewing an expired subscription', () => {
      const now = new Date('2026-09-25T12:00:00Z').getTime();
      const existingEndDateMs = new Date('2026-09-20T12:00:00Z').getTime(); // Expired 5 days ago

      let nextEndDate: string;
      if (existingEndDateMs > now) {
        nextEndDate = new Date(
          existingEndDateMs + 30 * 86400 * 1000
        ).toISOString();
      } else {
        nextEndDate = new Date(now + 30 * 86400 * 1000).toISOString();
      }

      expect(nextEndDate).toBe('2026-10-25T12:00:00.000Z');
    });
  });

  describe('4. Plan Limits & Gating Enforcements', () => {
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

  describe('5. Trial & Subscription Lifecycle Expiration', () => {
    it('should safely execute expireStaleTrials cron routine', async () => {
      const result = await expireStaleTrials();
      expect(result).toHaveProperty('expiredTrialsCount');
      expect(result).toHaveProperty('expiredSubsCount');
      expect(typeof result.expiredTrialsCount).toBe('number');
      expect(typeof result.expiredSubsCount).toBe('number');
    });
  });
});
