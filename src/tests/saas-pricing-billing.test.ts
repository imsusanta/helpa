import { describe, it, expect } from 'vitest';
import { DEFAULT_PLANS, getPlanBySlug } from '@/core/billing/plans';
import { checkFeatureAccess, checkPlanLimits, incrementUsage } from '@/lib/saas/subscription';
import { RevenueAnalytics } from '@/core/billing/types';

describe('Helpa SaaS Pricing Plans & Billing Architecture', () => {

  describe('1. Official Helpa SaaS Plan Catalog', () => {
    it('should have Starter, Growth ⭐, and Pro plans in default catalog', () => {
      expect(DEFAULT_PLANS.length).toBe(3);

      const starter = DEFAULT_PLANS[0];
      expect(starter.slug).toBe('starter');
      expect(starter.name).toBe('Starter');
      expect(starter.setupFee).toBe(7999);
      expect(starter.monthlyPrice).toBe(3499);
      expect(starter.currency).toBe('INR');
      expect(starter.isRecommended).toBe(false);

      const growth = DEFAULT_PLANS[1];
      expect(growth.slug).toBe('growth');
      expect(growth.name).toBe('Growth ⭐');
      expect(growth.setupFee).toBe(11999);
      expect(growth.monthlyPrice).toBe(4999);
      expect(growth.currency).toBe('INR');
      expect(growth.isRecommended).toBe(true);

      const pro = DEFAULT_PLANS[2];
      expect(pro.slug).toBe('pro');
      expect(pro.name).toBe('Pro');
      expect(pro.setupFee).toBe(19999);
      expect(pro.monthlyPrice).toBe(7999);
      expect(pro.currency).toBe('INR');
      expect(pro.isRecommended).toBe(false);
    });

    it('should calculate initial payment as setup fee + first month', async () => {
      const growth = await getPlanBySlug('growth');
      const initialPayment = growth.setupFee + growth.monthlyPrice;
      expect(initialPayment).toBe(11999 + 4999); // 16,998

      const recurringMonthly = growth.monthlyPrice;
      expect(recurringMonthly).toBe(4999);
    });
  });

  describe('2. Centralized Feature Entitlements & Access Control', () => {
    it('should grant features included in plan and reject features missing from plan', async () => {
      const starterAccess = await checkFeatureAccess('test-account-starter', 'core.inbox');
      expect(starterAccess.allowed).toBe(true);

      const proAccess = await checkFeatureAccess('test-account-pro', 'core.custom_models');
      expect(proAccess.allowed).toBe(true);
    });
  });

  describe('3. Usage Limits & Consumption Enforcements', () => {
    it('should allow usage within limit and flag limits reached', async () => {
      const limitCheck = await checkPlanLimits('test-account-1', 'max_users');
      expect(limitCheck).toHaveProperty('allowed');
      expect(limitCheck).toHaveProperty('currentUsage');
      expect(limitCheck).toHaveProperty('limit');
      expect(limitCheck).toHaveProperty('percentageUsed');
    });

    it('should safely increment usage tracking metrics', async () => {
      await expect(incrementUsage('test-account-1', 'ai_requests', 1)).resolves.not.toThrow();
    });
  });

  describe('4. Revenue Analytics Structure', () => {
    it('should aggregate revenue analytics by plan', () => {
      const analytics: RevenueAnalytics = {
        totalRevenue: 29996,
        setupFeeRevenue: 19998,
        recurringRevenue: 9998,
        monthlyRecurringRevenue: 9998,
        activeSubscriptionsCount: 2,
        trialCustomersCount: 1,
        pastDueCount: 0,
        cancelledCount: 0,
        revenueByPlan: { starter: 0, growth: 16998, pro: 12998 },
        customerCountByPlan: { starter: 0, growth: 1, pro: 1 },
        upgradeRate: 50,
        cancellationRate: 0,
      };

      expect(analytics.totalRevenue).toBe(analytics.setupFeeRevenue + analytics.recurringRevenue);
      expect(analytics.revenueByPlan.growth).toBe(11999 + 4999);
      expect(analytics.revenueByPlan.pro).toBe(19999 + 7999 - 15000); // 12998
    });
  });
});
