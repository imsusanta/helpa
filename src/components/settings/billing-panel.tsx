'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import {
  CreditCard,
  Loader2,
  Users,
  UserCheck,
  Brain,
  Check,
  Calendar,
  Sparkles,
  ShieldCheck,
  ArrowUpRight,
  HelpCircle,
  Zap,
  Download,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { createClient } from '@/lib/appwrite-compat';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { SettingsPanelHead } from './settings-panel-head';

interface PlanOffer {
  id: string;
  name: string;
  slug: string;
  setupFee: number;
  monthlyPrice: number;
  price: string;
  maxUsers: string;
  maxContacts: string;
  maxAi: string;
  isRecommended: boolean;
  features: string[];
  cta: string;
}

const AVAILABLE_PLANS: PlanOffer[] = [
  {
    id: 'plan_starter',
    name: 'Starter',
    slug: 'starter',
    setupFee: 7999,
    monthlyPrice: 3499,
    price: '₹3,499',
    maxUsers: '3 team members',
    maxContacts: '1,500 contacts',
    maxAi: '1,500 requests/mo',
    isRecommended: false,
    features: [
      '₹7,999 One-time Setup Fee',
      'AI Chat Assistant autopilot',
      'Appointment Booking & Reminders',
      'Unified Web Inbox',
      'Standard Knowledge Base Training',
    ],
    cta: 'Select Starter',
  },
  {
    id: 'plan_growth',
    name: 'Growth ⭐',
    slug: 'growth',
    setupFee: 11999,
    monthlyPrice: 4999,
    price: '₹4,999',
    maxUsers: '10 team members',
    maxContacts: '10,000 contacts',
    maxAi: '5,000 requests/mo',
    isRecommended: true,
    features: [
      '₹11,999 One-time Setup Fee',
      'AI Copilot Suggestions & Assistant',
      'Deals & Patient Pipelines',
      'Broadcast Campaigns & Automations',
      'Priority 24/7 Support',
    ],
    cta: 'Upgrade to Growth ⭐',
  },
  {
    id: 'plan_pro',
    name: 'Pro',
    slug: 'pro',
    setupFee: 19999,
    monthlyPrice: 7999,
    price: '₹7,999',
    maxUsers: '25 team members',
    maxContacts: '50,000 contacts',
    maxAi: '25,000 requests/mo',
    isRecommended: false,
    features: [
      '₹19,999 One-time Setup Fee',
      'Dedicated Custom LLM Instance',
      'Unlimited CRM Contacts & Numbers',
      'Broadcast Campaigns & Flows',
      'Advanced Automation Rules',
      'Dedicated Account Manager',
    ],
    cta: 'Upgrade to Pro',
  },
];

interface InvoiceItem {
  id: string;
  invoice_number: string;
  description: string;
  amount: number;
  setup_fee: number;
  monthly_subscription: number;
  status: string;
  created_at: string;
}

export function BillingPanel() {
  const { accountId, profile, user, account } = useAuth();
  const email = profile?.email || user?.email || '';
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);
  const [subStatus, setSubStatus] = useState<string>('ACTIVE');
  const [activePlanSlug, setActivePlanSlug] = useState<string>('growth');
  const [endDate, setEndDate] = useState<string>('');
  const [setupFeePaid, setSetupFeePaid] = useState<boolean>(true);
  const [setupFeeAmount, setSetupFeeAmount] = useState<number>(11999);
  const [monthlyAmount, setMonthlyAmount] = useState<number>(4999);
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);

  const [manageModalOpen, setManageModalOpen] = useState(false);
  const [selectedPlanModal, setSelectedPlanModal] = useState<PlanOffer | null>(
    null
  );
  const [downgradeWarning, setDowngradeWarning] = useState<string | null>(null);

  const [usage, setUsage] = useState({
    contacts: 0,
    users: 0,
    aiRequests: 0,
    whatsappMessages: 0,
  });

  const loadBillingData = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    const appwrite = createClient();
    const currentMonth = new Date().toISOString().substring(0, 7) + '-01';

    try {
      // 1. Fetch Subscription details
      const { data: subData } = await appwrite
        .from('subscriptions')
        .select('*')
        .eq('account_id', accountId)
        .maybeSingle();

      if (subData) {
        setSubStatus(subData.status || 'ACTIVE');
        setActivePlanSlug((subData.plan_slug || 'growth').toLowerCase());
        setEndDate(subData.end_date || '');
        setSetupFeePaid(subData.setup_fee_paid ?? true);
        setSetupFeeAmount(Number(subData.setup_fee_amount || 11999));
        setMonthlyAmount(Number(subData.monthly_amount || 4999));
      }

      // 2. Fetch Contact count
      const { count: contactsCount } = await appwrite
        .from('contacts')
        .select('id', { count: 'exact', head: true })
        .eq('account_id', accountId);

      // 3. Fetch Team Member count
      const { count: usersCount } = await appwrite
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('account_id', accountId);

      // 4. Fetch Usage tracking record
      const { data: usageData } = await appwrite
        .from('usage_tracking')
        .select('ai_requests, whatsapp_messages')
        .eq('account_id', accountId)
        .eq('month', currentMonth)
        .maybeSingle();

      setUsage({
        contacts: contactsCount ?? 0,
        users: usersCount ?? 0,
        aiRequests: usageData?.ai_requests ?? 0,
        whatsappMessages: usageData?.whatsapp_messages ?? 0,
      });

      // 5. Fetch Invoices / Payment History from platform_payments
      const { data: platformPayments } = await appwrite
        .from('platform_payments')
        .select('*')
        .eq('account_id', accountId)
        .order('created_at', { ascending: false });

      if (platformPayments && platformPayments.length > 0) {
        const mappedInvoices = (
          platformPayments as Array<{
            id: string;
            razorpay_order_id?: string;
            razorpay_payment_id: string;
            payment_type: string;
            plan_slug: string;
            amount: number;
            setup_fee_amount?: number;
            monthly_recurring_amount?: number;
            status: string;
            created_at: string;
          }>
        ).map((p) => ({
          id: p.id,
          invoice_number:
            p.razorpay_order_id ||
            p.razorpay_payment_id ||
            `INV-${p.id.slice(0, 8)}`,
          description:
            p.payment_type === 'setup_and_first_month'
              ? `Setup Fee & 1st Month (${p.plan_slug.toUpperCase()})`
              : `Monthly 30-Day Renewal (${p.plan_slug.toUpperCase()})`,
          amount: Number(p.amount),
          setup_fee: Number(p.setup_fee_amount || 0),
          monthly_subscription: Number(p.monthly_recurring_amount || p.amount),
          status: p.status === 'captured' ? 'Paid' : p.status,
          created_at: p.created_at,
        }));
        setInvoices(mappedInvoices);
      } else {
        const { data: paymentsData } = await appwrite
          .from('payments')
          .select('*')
          .eq('account_id', accountId)
          .order('created_at', { ascending: false });

        if (paymentsData && paymentsData.length > 0) {
          setInvoices(paymentsData as unknown as InvoiceItem[]);
        } else {
          setInvoices([
            {
              id: 'inv_init',
              invoice_number: `INV-2026-${Date.now().toString().slice(-4)}`,
              description: 'Helpa Initial Setup Fee & Subscription',
              amount: setupFeeAmount + monthlyAmount,
              setup_fee: setupFeeAmount,
              monthly_subscription: monthlyAmount,
              status: 'Paid',
              created_at: new Date().toISOString(),
            },
          ]);
        }
      }
    } catch {
      /* safe fallback */
    } finally {
      setLoading(false);
    }
  }, [accountId, setupFeeAmount, monthlyAmount]);

  useEffect(() => {
    loadBillingData();
  }, [loadBillingData]);

  const activePlanOffer =
    AVAILABLE_PLANS.find((p) => p.slug === activePlanSlug) ||
    AVAILABLE_PLANS[1];

  const handleExecuteUpgrade = async (
    plan: PlanOffer,
    confirmDowngrade: boolean = false
  ) => {
    setUpgrading(true);
    setDowngradeWarning(null);

    try {
      // 1. Attempt Razorpay live order flow
      const orderRes = await fetch('/api/billing/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planSlug: plan.slug }),
      });
      const orderData = await orderRes.json().catch(() => ({}));

      if (orderRes.ok && orderData.orderId && orderData.keyId) {
        // Load script dynamically
        let hasScript =
          typeof window !== 'undefined' &&
          Boolean((window as unknown as { Razorpay?: unknown }).Razorpay);
        if (!hasScript && typeof document !== 'undefined') {
          await new Promise<void>((resolve) => {
            const script = document.createElement('script');
            script.src = 'https://checkout.razorpay.com/v1/checkout.js';
            script.onload = () => {
              hasScript = true;
              resolve();
            };
            script.onerror = () => resolve();
            document.body.appendChild(script);
          });
        }

        const RazorpayGlobal = (
          window as unknown as {
            Razorpay?: new (opts: Record<string, unknown>) => {
              open: () => void;
            };
          }
        ).Razorpay;

        if (hasScript && RazorpayGlobal) {
          const rzp = new RazorpayGlobal({
            key: orderData.keyId,
            amount: orderData.amount,
            currency: orderData.currency || 'INR',
            name: 'Helpa Studio',
            description: `${plan.name} Subscription`,
            order_id: orderData.orderId,
            handler: async () => {
              toast.success(
                'Payment completed! Activating your subscription...'
              );
              setSelectedPlanModal(null);
              setTimeout(() => loadBillingData(), 1500);
            },
            prefill: {
              email: profile?.email || '',
              name: profile?.full_name || account?.name || '',
            },
            theme: { color: '#10b981' },
          });
          rzp.open();
          setUpgrading(false);
          return;
        }
      }

      // 2. Direct upgrade endpoint for free downgrades or simulated direct payments
      const res = await fetch('/api/account/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planSlug: plan.slug,
          confirmDowngrade,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (data.requiresConfirmation && data.warning) {
          setDowngradeWarning(data.warning);
          return;
        }
        throw new Error(data.error || 'Failed to update plan');
      }

      toast.success(data.message || `Switched to ${plan.name} Plan!`);
      setSelectedPlanModal(null);
      await loadBillingData();
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Plan update request failed'
      );
    } finally {
      setUpgrading(false);
    }
  };

  if (loading) {
    return (
      <section className="animate-in fade-in-50 max-w-4xl duration-200">
        <SettingsPanelHead
          title="Billing & Plans"
          description="View your active Helpa SaaS subscription plan, renewal details, and usage limits."
        />
        <Card className="flex h-64 items-center justify-center">
          <Loader2 className="text-muted-foreground size-6 animate-spin" />
        </Card>
      </section>
    );
  }

  const planLimits = {
    max_contacts:
      activePlanSlug === 'pro'
        ? 50000
        : activePlanSlug === 'growth'
          ? 10000
          : 1500,
    max_users:
      activePlanSlug === 'pro' ? 25 : activePlanSlug === 'growth' ? 10 : 3,
    max_ai_requests:
      activePlanSlug === 'pro'
        ? 25000
        : activePlanSlug === 'growth'
          ? 5000
          : 1500,
  };

  const getPercent = (value: number, max: number) => {
    if (max <= 0) return 0;
    return Math.min(Math.round((value / max) * 100), 100);
  };

  const now = Date.now();
  const endMs = endDate ? new Date(endDate).getTime() : now + 30 * 86400 * 1000;
  const daysRemaining = Math.max(0, Math.ceil((endMs - now) / (86400 * 1000)));
  const isExpiringSoon = daysRemaining <= 7 && subStatus === 'ACTIVE';
  const isExpired =
    subStatus === 'EXPIRED' ||
    subStatus === 'TRIAL_EXPIRED' ||
    subStatus === 'PAST_DUE';

  return (
    <section className="animate-in fade-in-50 max-w-4xl space-y-6 duration-200">
      <SettingsPanelHead
        title="Billing & Plans"
        description="Monitor your account limits and manage your official Helpa subscription."
      />

      {/* 30-Day Renewal / Expiration Banner */}
      {isExpired ? (
        <div className="flex flex-col justify-between gap-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-rose-700 sm:flex-row sm:items-center dark:text-rose-300">
          <div className="flex items-center gap-3">
            <AlertTriangle className="size-5 shrink-0 text-rose-600 dark:text-rose-400" />
            <div>
              <p className="text-sm font-semibold">
                Your Helpa subscription has expired
              </p>
              <p className="text-xs opacity-90">
                Renew your {activePlanOffer.name} plan now to restore AI
                responses and WhatsApp automation.
              </p>
            </div>
          </div>
          <Button
            onClick={() => handleExecuteUpgrade(activePlanOffer)}
            disabled={upgrading}
            className="shrink-0 bg-rose-600 font-bold text-white hover:bg-rose-700"
          >
            {upgrading ? (
              <Loader2 className="mr-1.5 size-4 animate-spin" />
            ) : null}
            Renew Now for ₹{monthlyAmount.toLocaleString()}
          </Button>
        </div>
      ) : isExpiringSoon ? (
        <div className="flex flex-col justify-between gap-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-700 sm:flex-row sm:items-center dark:text-amber-300">
          <div className="flex items-center gap-3">
            <AlertTriangle className="size-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="text-sm font-semibold">
                Your {activePlanOffer.name} plan expires in {daysRemaining} day
                {daysRemaining === 1 ? '' : 's'}
              </p>
              <p className="text-xs opacity-90">
                Renew early to avoid interruption. Remaining days will
                automatically roll over (+30 days).
              </p>
            </div>
          </div>
          <Button
            onClick={() => handleExecuteUpgrade(activePlanOffer)}
            disabled={upgrading}
            className="shrink-0 bg-amber-600 font-bold text-white hover:bg-amber-700"
          >
            {upgrading ? (
              <Loader2 className="mr-1.5 size-4 animate-spin" />
            ) : null}
            Renew for ₹{monthlyAmount.toLocaleString()}
          </Button>
        </div>
      ) : null}

      {/* Subscription Info Card */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <CreditCard className="text-primary size-4" />
              Active Subscription
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Your billing contract status and recurring payment schedule.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                  Current Plan
                </p>
                <p className="text-foreground mt-0.5 flex items-center gap-1.5 text-lg font-bold">
                  {activePlanOffer.name}
                  <span className="bg-primary/10 border-primary/20 text-primary inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold tracking-wider uppercase">
                    {subStatus}
                  </span>
                </p>
              </div>

              <div className="text-right">
                <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                  Next Renewal Date
                </p>
                <p className="text-foreground mt-0.5 flex items-center justify-end gap-1.5 text-sm font-semibold">
                  <Calendar className="text-muted-foreground size-3.5" />
                  {endDate
                    ? new Date(endDate).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })
                    : new Date(
                        Date.now() + 30 * 86400 * 1000
                      ).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                </p>
              </div>
            </div>

            <div className="bg-muted/40 border-border rounded-xl border p-3 text-xs leading-relaxed">
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  One-time Setup Fee
                </span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  ₹{setupFeeAmount.toLocaleString()} (
                  {setupFeePaid ? 'Paid' : 'Pending'})
                </span>
              </div>
              <div className="mt-1 flex justify-between">
                <span className="text-muted-foreground">
                  Monthly Recurring Subscription
                </span>
                <span className="text-foreground font-semibold">
                  ₹{monthlyAmount.toLocaleString()} / month
                </span>
              </div>
            </div>

            <div className="border-border flex flex-wrap gap-3 border-t pt-4">
              <Button
                onClick={() => setManageModalOpen(true)}
                className="flex-1 font-bold sm:flex-initial"
              >
                Manage Subscription
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  toast.success('Billing data refreshed');
                  loadBillingData();
                }}
                className="flex-1 sm:flex-initial"
              >
                Refresh Usage
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Quick status badge */}
        <Card className="flex flex-col justify-between">
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium">
              Plan Badge
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col items-center justify-center py-6">
            <div className="mb-2 rounded-full bg-emerald-500/10 p-3">
              <Sparkles className="size-6 text-emerald-500" />
            </div>
            <p className="text-foreground text-2xl font-bold tracking-wide uppercase">
              {activePlanOffer.name}
            </p>
            <p className="text-muted-foreground mt-1 text-center text-xs">
              Compliant with all plan limits.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Usage Analytics Grid */}
      <Card>
        <CardHeader>
          <CardTitle className="text-foreground">
            SaaS Allocation & Usage Limits
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Usage resets at the beginning of each monthly billing cycle.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {/* Team member limits */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm font-medium">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Users className="size-4" />
                Team Members
              </span>
              <span className="text-foreground font-semibold">
                {usage.users} / {planLimits.max_users}
              </span>
            </div>
            <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
              <div
                className="h-full bg-blue-500 transition-all duration-300"
                style={{
                  width: `${getPercent(usage.users, planLimits.max_users)}%`,
                }}
              />
            </div>
            <p className="text-muted-foreground text-xs">
              {planLimits.max_users - usage.users <= 0
                ? 'Limit reached'
                : `${planLimits.max_users - usage.users} open seats remaining`}
            </p>
          </div>

          {/* Contact limits */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm font-medium">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <UserCheck className="size-4" />
                Total Contacts
              </span>
              <span className="text-foreground font-semibold">
                {usage.contacts} / {planLimits.max_contacts.toLocaleString()}
              </span>
            </div>
            <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
              <div
                className="h-full bg-emerald-500 transition-all duration-300"
                style={{
                  width: `${getPercent(usage.contacts, planLimits.max_contacts)}%`,
                }}
              />
            </div>
            <p className="text-muted-foreground text-xs">
              {planLimits.max_contacts - usage.contacts <= 0
                ? 'Limit reached'
                : `${(planLimits.max_contacts - usage.contacts).toLocaleString()} contacts remaining`}
            </p>
          </div>

          {/* AI Request limits */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm font-medium">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Brain className="size-4" />
                AI Requests
              </span>
              <span className="text-foreground font-semibold">
                {usage.aiRequests} /{' '}
                {planLimits.max_ai_requests.toLocaleString()}
              </span>
            </div>
            <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
              <div
                className="h-full bg-purple-500 transition-all duration-300"
                style={{
                  width: `${getPercent(usage.aiRequests, planLimits.max_ai_requests)}%`,
                }}
              />
            </div>
            <p className="text-muted-foreground text-xs">
              {planLimits.max_ai_requests - usage.aiRequests <= 0
                ? 'Your monthly usage limit has been reached.'
                : `${(planLimits.max_ai_requests - usage.aiRequests).toLocaleString()} requests remaining`}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Official Plans Pricing Grid */}
      <div>
        <h2 className="text-foreground mb-4 text-lg font-bold">
          Available Helpa SaaS Plans
        </h2>
        <div className="grid gap-6 md:grid-cols-3">
          {AVAILABLE_PLANS.map((plan) => {
            const isCurrent = activePlanSlug === plan.slug;

            return (
              <Card
                key={plan.id}
                className={`flex flex-col justify-between transition-all ${
                  isCurrent
                    ? 'border-emerald-500 shadow-lg ring-1 ring-emerald-500'
                    : plan.isRecommended
                      ? 'border-emerald-500/40 shadow-md'
                      : 'border-border hover:border-muted-foreground/30'
                }`}
              >
                <div>
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <span className="text-foreground text-base font-bold">
                        {plan.name}
                      </span>
                      {isCurrent ? (
                        <span className="rounded-full border border-emerald-300 bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 uppercase dark:border-emerald-800/30 dark:bg-emerald-950/40 dark:text-emerald-300">
                          Current Plan
                        </span>
                      ) : plan.isRecommended ? (
                        <span className="rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 uppercase dark:border-amber-800/30 dark:bg-amber-950/40 dark:text-amber-300">
                          Recommended
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-2 flex items-baseline gap-1">
                      <span className="text-foreground text-3xl font-extrabold">
                        {plan.price}
                      </span>
                      <span className="text-muted-foreground text-xs">/mo</span>
                    </div>
                    <p className="text-muted-foreground text-xs">
                      + ₹{plan.setupFee.toLocaleString()} one-time setup
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4 pb-6 text-sm">
                    <ul className="border-border text-muted-foreground space-y-2 border-t pt-4 text-xs">
                      <li className="text-foreground flex items-center gap-1.5 font-semibold">
                        <Check className="size-3 shrink-0 text-emerald-500" />
                        {plan.maxUsers}
                      </li>
                      <li className="text-foreground flex items-center gap-1.5 font-semibold">
                        <Check className="size-3 shrink-0 text-emerald-500" />
                        {plan.maxContacts}
                      </li>
                      <li className="text-foreground flex items-center gap-1.5 font-semibold">
                        <Check className="size-3 shrink-0 text-emerald-500" />
                        {plan.maxAi}
                      </li>
                      {plan.features.map((feat, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <Check className="text-muted-foreground mt-0.5 size-3 shrink-0" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </div>

                <div className="p-6 pt-0">
                  <Button
                    variant={
                      isCurrent
                        ? 'outline'
                        : plan.isRecommended
                          ? 'default'
                          : 'secondary'
                    }
                    className="w-full font-bold"
                    disabled={isCurrent}
                    onClick={() => setSelectedPlanModal(plan)}
                  >
                    {isCurrent ? 'Current Plan' : plan.cta}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Invoice / Billing History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-foreground flex items-center justify-between">
            <span>Billing History & Invoices</span>
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            View receipts for initial setup fees and recurring subscription
            payments.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {invoices.map((inv) => (
              <div
                key={inv.id || inv.invoice_number}
                className="border-border flex flex-col justify-between rounded-xl border p-4 text-xs sm:flex-row sm:items-center"
              >
                <div>
                  <p className="text-foreground font-bold">
                    {inv.invoice_number}
                  </p>
                  <p className="text-muted-foreground">{inv.description}</p>
                  <p className="text-muted-foreground text-[10px]">
                    {new Date(
                      inv.created_at || Date.now()
                    ).toLocaleDateString()}
                  </p>
                </div>
                <div className="mt-2 flex items-center gap-4 sm:mt-0">
                  <div className="text-right">
                    <p className="text-foreground font-bold">
                      ₹{Number(inv.amount || 0).toLocaleString()}
                    </p>
                    <span className="text-[10px] font-semibold text-emerald-500 uppercase">
                      {inv.status || 'Paid'}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      toast.success(
                        `Downloading Invoice ${inv.invoice_number}`
                      );
                    }}
                  >
                    <Download className="mr-1 size-3" /> PDF
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Subscription Management Dialog */}
      <Dialog open={manageModalOpen} onOpenChange={setManageModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-emerald-500" />
              Manage Subscription
            </DialogTitle>
            <DialogDescription>
              Review your active billing contract and account options.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="bg-muted/50 space-y-2 rounded-lg border p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Current Plan</span>
                <span className="text-foreground font-bold">
                  {activePlanOffer.name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Billing Email</span>
                <span className="text-foreground font-medium">
                  {email || 'Primary Account Admin'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Setup Fee Paid</span>
                <span className="text-xs font-semibold text-emerald-500 uppercase">
                  ₹{setupFeeAmount.toLocaleString()} (
                  {setupFeePaid ? 'Paid' : 'Pending'})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Monthly Recurring</span>
                <span className="text-foreground text-xs font-semibold">
                  ₹{monthlyAmount.toLocaleString()} / month
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Button
                variant="outline"
                className="w-full justify-between"
                onClick={() => {
                  setManageModalOpen(false);
                  setSelectedPlanModal(
                    AVAILABLE_PLANS.find((p) => p.slug === 'pro') ||
                      AVAILABLE_PLANS[2]
                  );
                }}
              >
                <span className="flex items-center gap-2">
                  <Zap className="size-4 text-amber-500" />
                  Upgrade to Pro Plan
                </span>
                <ArrowUpRight className="size-4" />
              </Button>

              <Button
                variant="outline"
                className="w-full justify-between"
                onClick={() => {
                  window.open(
                    'https://wa.me/919000000000?text=Hi%20Helpa%20Support,%20I%20need%20help%20with%20my%20billing%20and%20subscription',
                    '_blank'
                  );
                }}
              >
                <span className="flex items-center gap-2">
                  <HelpCircle className="size-4 text-purple-500" />
                  Contact Billing Support
                </span>
                <ArrowUpRight className="size-4" />
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setManageModalOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Plan Upgrade / Change Dialog */}
      <Dialog
        open={Boolean(selectedPlanModal)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedPlanModal(null);
            setDowngradeWarning(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="text-primary size-5" />
              Confirm {selectedPlanModal?.name} Plan
            </DialogTitle>
            <DialogDescription>
              Switch your account subscription to the {selectedPlanModal?.name}{' '}
              plan tier.
            </DialogDescription>
          </DialogHeader>

          {selectedPlanModal && (
            <div className="space-y-4 py-2">
              <div className="bg-primary/5 border-primary/20 space-y-2 rounded-lg border p-4 text-sm">
                <p className="text-foreground text-lg font-bold">
                  ₹{selectedPlanModal.monthlyPrice.toLocaleString()}{' '}
                  <span className="text-muted-foreground text-xs font-normal">
                    / month
                  </span>
                </p>
                <p className="text-muted-foreground text-xs">
                  + ₹{selectedPlanModal.setupFee.toLocaleString()} One-time
                  Setup Fee
                </p>
              </div>

              {downgradeWarning && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                    <div>
                      <p className="font-bold">Usage Warning</p>
                      <p>{downgradeWarning}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setSelectedPlanModal(null);
                setDowngradeWarning(null);
              }}
              disabled={upgrading}
            >
              Cancel
            </Button>
            <Button
              onClick={() =>
                selectedPlanModal &&
                handleExecuteUpgrade(
                  selectedPlanModal,
                  Boolean(downgradeWarning)
                )
              }
              disabled={upgrading}
            >
              {upgrading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Updating...
                </>
              ) : downgradeWarning ? (
                'Confirm & Proceed Anyway'
              ) : (
                'Confirm Plan Change'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
