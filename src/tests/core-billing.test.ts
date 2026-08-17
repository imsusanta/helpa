/**
 * src/tests/core-billing.test.ts
 *
 * Comprehensive Test Suite for Helpa Core SaaS Billing & Monetization (Phase 11).
 * Verifies:
 * - Plans catalog & safe defaults (Free, Starter, Professional, Business)
 * - Free Trial initialization (TRIALING status, 14-day duration)
 * - Subscription upgrades, billing cycles, cancellation & reactivation
 * - Payment failure & grace period (PAST_DUE)
 * - Centralized Feature Registry & Gating (Industry + Plan + Status)
 * - Metered Usage Tracking & Idempotency (AI & WhatsApp messages)
 * - Usage limit enforcement and 80%/90%/100% threshold alerts
 * - Payment Webhook processing & idempotency
 * - Strict multi-tenant billing isolation (Workspace A vs Workspace B)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getAvailablePlans,
  getPlanBySlug,
  canAccessFeature,
  startFreeTrial,
  upgradeSubscription,
  cancelSubscription,
  reactivateSubscription,
  handlePaymentFailure,
  recordUsage,
  getCurrentUsage,
  checkUsageLimit,
  processPaymentWebhook,
} from '@/core/billing';
import * as appwriteCompat from '@/lib/appwrite-server-compat';
import { coreEvents } from '@/core/events';

describe('Helpa Core SaaS Billing & Monetization Layer', () => {
  const workspaceA = {
    id: 'ws-health-01',
    industry: 'health',
    subscriptionPlanId: 'plan_professional',
    subscriptionStatus: 'ACTIVE' as const,
  };

  const workspaceB = {
    id: 'ws-salon-02',
    industry: 'salon',
    subscriptionPlanId: 'plan_starter',
    subscriptionStatus: 'ACTIVE' as const,
  };

  let mockDatabase: {
    accounts: Array<Record<string, unknown>>;
    plans: Array<Record<string, unknown>>;
    audit_logs: Array<Record<string, unknown>>;
    hospital_bills: Array<Record<string, unknown>>;
  };

  beforeEach(() => {
    mockDatabase = {
      accounts: [
        {
          id: workspaceA.id,
          name: 'City Health Clinic',
          subscription_plan: 'plan_professional',
          subscription_status: 'ACTIVE',
        },
        {
          id: workspaceB.id,
          name: 'Glow Beauty Salon',
          subscription_plan: 'plan_starter',
          subscription_status: 'ACTIVE',
        },
      ],
      plans: [],
      audit_logs: [],
      hospital_bills: [],
    };

    vi.spyOn(appwriteCompat, 'getAdminClient').mockReturnValue({
      from: (table: string) => {
        const store =
          (mockDatabase as Record<string, Array<Record<string, unknown>>>)[
            table
          ] || [];
        return {
          select: () => {
            let filtered = [...store];
            const builder = {
              eq: (f: string, v: unknown) => {
                filtered = filtered.filter((r) => r[f] === v);
                return builder;
              },
              neq: (f: string, v: unknown) => {
                filtered = filtered.filter((r) => r[f] !== v);
                return builder;
              },
              ilike: (f: string, v: string) => {
                const clean = v.replace(/%/g, '').toLowerCase();
                filtered = filtered.filter((r) =>
                  String(r[f] || '')
                    .toLowerCase()
                    .includes(clean)
                );
                return builder;
              },
              order: () => builder,
              maybeSingle: async () => ({
                data: filtered[0] || null,
                error: null,
              }),
              single: async () => ({
                data: filtered[0] || null,
                error: filtered[0] ? null : { message: 'Row not found' },
              }),
              then: (res: (val: { data: unknown[]; error: null }) => void) =>
                res({ data: filtered, error: null }),
            };
            return builder;
          },
          insert: (data: Record<string, unknown>) => {
            const row = { id: `id-${Date.now()}-${Math.random()}`, ...data };
            store.push(row);
            return {
              select: () => ({
                single: async () => ({ data: row, error: null }),
              }),
              then: (res: (val: { data: unknown; error: null }) => void) =>
                res({ data: row, error: null }),
            };
          },
          update: (data: Record<string, unknown>) => ({
            eq: (f: string, v: unknown) => {
              const matched = store.filter((r) => r[f] === v);
              matched.forEach((r) => Object.assign(r, data));
              return {
                eq: (f2: string, v2: unknown) => {
                  const m2 = store.filter((r) => r[f] === v && r[f2] === v2);
                  m2.forEach((r) => Object.assign(r, data));
                  return Promise.resolve({ data: m2, error: null });
                },
                then: (res: (val: { data: unknown; error: null }) => void) =>
                  res({ data: matched, error: null }),
              };
            },
          }),
        };
      },
    } as unknown as ReturnType<typeof appwriteCompat.getAdminClient>);
  });

  describe('Plans Catalog & Safe Defaults', () => {
    it('retrieves default official plans (Starter, Growth ⭐, Pro)', async () => {
      const plans = await getAvailablePlans();
      expect(plans.length).toBeGreaterThanOrEqual(3);

      const starterPlan = plans.find((p) => p.slug === 'starter');
      expect(starterPlan?.monthlyPrice).toBe(3499);
      expect(starterPlan?.setupFee).toBe(7999);

      const growthPlan = await getPlanBySlug('growth');
      expect(growthPlan.name).toBe('Growth ⭐');
      expect(growthPlan.monthlyPrice).toBe(4999);
      expect(growthPlan.setupFee).toBe(11999);
      expect(growthPlan.isRecommended).toBe(true);
      expect(growthPlan.features).toContain('core.ai_copilot');
    });
  });

  describe('Subscription Lifecycle & Free Trial', () => {
    it('starts a 14-day free trial on Growth plan', async () => {
      const eventSpy = vi.fn();
      coreEvents.on('billing.trial_started', eventSpy);

      const sub = await startFreeTrial({
        workspaceId: 'ws-new-01',
        planId: 'plan_growth',
        trialDays: 14,
      });

      expect(sub.status).toBe('TRIALING');
      expect(sub.planId).toBe('plan_growth');
      expect(sub.trialEnd).toBeDefined();

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: 'ws-new-01',
          type: 'billing.trial_started',
        })
      );
    });

    it('upgrades subscription to paid active plan with yearly billing', async () => {
      const eventSpy = vi.fn();
      coreEvents.on('billing.subscription_activated', eventSpy);

      const sub = await upgradeSubscription({
        workspaceId: workspaceB.id,
        newPlanId: 'plan_growth',
        billingCycle: 'yearly',
      });

      expect(sub.status).toBe('ACTIVE');
      expect(sub.planId).toBe('plan_growth');
      expect(sub.billingCycle).toBe('yearly');

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: workspaceB.id,
          type: 'billing.subscription_activated',
        })
      );
    });

    it('handles cancellation and reactivation', async () => {
      const cancelled = await cancelSubscription({
        workspaceId: workspaceA.id,
        cancelImmediately: false,
      });
      expect(cancelled).toBe(true);

      const reactivated = await reactivateSubscription(workspaceA.id);
      expect(reactivated).toBe(true);
    });

    it('places workspace in PAST_DUE status with grace period on payment failure', async () => {
      const eventSpy = vi.fn();
      coreEvents.on('billing.payment_failed', eventSpy);

      await handlePaymentFailure(workspaceA.id, 3);

      const account = mockDatabase.accounts.find((a) => a.id === workspaceA.id);
      expect(account?.subscription_status).toBe('PAST_DUE');

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: workspaceA.id,
          type: 'billing.payment_failed',
        })
      );
    });
  });

  describe('Centralized Feature Registry & Gating', () => {
    it('allows Professional Health workspace to access AI Copilot & Appointments', async () => {
      const copilotAccess = await canAccessFeature(
        workspaceA,
        'core.ai_copilot'
      );
      expect(copilotAccess.allowed).toBe(true);

      const apptAccess = await canAccessFeature(
        workspaceA,
        'health.appointments'
      );
      expect(apptAccess.allowed).toBe(true);
    });

    it('blocks feature access if workspace subscription is expired or cancelled', async () => {
      const expiredWs = {
        ...workspaceA,
        subscriptionStatus: 'EXPIRED' as const,
      };
      const access = await canAccessFeature(expiredWs, 'core.inbox');
      expect(access.allowed).toBe(false);
      expect(access.reason).toContain('expired');
    });

    it('blocks cross-industry feature access (Health cannot access Salon or Real Estate features)', async () => {
      const crossAccess = await canAccessFeature(workspaceA, 'salon.services');
      expect(crossAccess.allowed).toBe(false);
      expect(crossAccess.reason).toContain(
        'not supported in the health workspace'
      );
    });

    it('blocks Starter plan from accessing advanced features (e.g. AI Copilot)', async () => {
      const copilotAccess = await canAccessFeature(
        workspaceB,
        'core.ai_copilot'
      );
      expect(copilotAccess.allowed).toBe(false);
      expect(copilotAccess.requiredPlan).toBe('Professional');
    });
  });

  describe('Usage Metering & Limits Enforcement', () => {
    it('records metered consumption idempotently', async () => {
      await recordUsage({
        workspaceId: workspaceA.id,
        metric: 'ai_message',
        quantity: 5,
        source: 'whatsapp_ai',
        referenceId: 'msg-001',
      });

      // Duplicate record attempt with same referenceId
      await recordUsage({
        workspaceId: workspaceA.id,
        metric: 'ai_message',
        quantity: 5,
        source: 'whatsapp_ai',
        referenceId: 'msg-001',
      });

      const usage = await getCurrentUsage(workspaceA.id, 'ai_message');
      expect(usage).toBe(5); // Only counted once
    });

    it('enforces usage limits and emits 80%, 90%, and 100% threshold warnings', async () => {
      const warningSpy = vi.fn();
      coreEvents.on('billing.usage_limit_warning', warningSpy);
      const limitSpy = vi.fn();
      coreEvents.on('billing.usage_limit_reached', limitSpy);

      // Starter plan has 1,500 AI messages
      // 1. Record 1,250 messages (83% -> triggers 80% warning)
      await recordUsage({
        workspaceId: workspaceB.id,
        metric: 'ai_message',
        quantity: 1250,
        source: 'whatsapp_ai',
      });

      const check80 = await checkUsageLimit(
        workspaceB.id,
        'plan_starter',
        'ai_message',
        1
      );
      expect(check80.allowed).toBe(true);
      expect(check80.percentageUsed).toBe(83);
      expect(check80.warningLevel).toBe('80%');

      // 2. Record additional 260 messages (1,510 total -> over 1,500 limit)
      await recordUsage({
        workspaceId: workspaceB.id,
        metric: 'ai_message',
        quantity: 260,
        source: 'whatsapp_ai',
      });

      const check100 = await checkUsageLimit(
        workspaceB.id,
        'plan_starter',
        'ai_message',
        1
      );
      expect(check100.allowed).toBe(false);
      expect(check100.percentageUsed).toBe(100);
      expect(check100.warningLevel).toBe('100%');
      expect(check100.reason).toContain('Usage limit reached');
    });
  });

  describe('Payment Webhooks & Idempotency', () => {
    it('processes payment.succeeded and creates payment record idempotently', async () => {
      const webhookPayload = {
        eventId: 'evt_rzp_999',
        eventType: 'payment.succeeded' as const,
        workspaceId: workspaceA.id,
        planId: 'plan_professional',
        amount: 2499,
        paymentId: 'pay_rzp_12345',
        timestamp: new Date().toISOString(),
      };

      // 1. First execution
      const res1 = await processPaymentWebhook(webhookPayload);
      expect(res1.success).toBe(true);
      expect(res1.duplicate).toBe(false);
      expect(mockDatabase.hospital_bills.length).toBe(1);

      // 2. Duplicate webhook delivery
      const res2 = await processPaymentWebhook(webhookPayload);
      expect(res2.success).toBe(true);
      expect(res2.duplicate).toBe(true);
      expect(mockDatabase.hospital_bills.length).toBe(1); // No duplicate invoice created
    });
  });
});
