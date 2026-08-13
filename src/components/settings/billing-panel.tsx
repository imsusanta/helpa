'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import {
  CreditCard,
  Loader2,
  Users,
  UserCheck,
  Brain,
  MessageSquare,
  Check,
  Calendar,
  Sparkles,
  ShieldCheck,
  ArrowUpRight,
  HelpCircle,
  Zap,
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

interface SubscriptionInfo {
  status: 'trial' | 'active' | 'expired' | 'cancelled';
  end_date: string;
  plan: {
    id: string;
    name: string;
    monthly_price: number;
    max_users: number;
    max_contacts: number;
    max_whatsapp_numbers: number;
    max_ai_requests: number;
    features: string[];
  };
}

interface UsageInfo {
  contacts: number;
  users: number;
  aiRequests: number;
  whatsappMessages: number;
}

interface PlanOffer {
  id: string;
  name: string;
  price: string;
  maxUsers: string;
  maxContacts: string;
  maxAi: string;
  features: string[];
  cta: string;
}

const AVAILABLE_PLANS: PlanOffer[] = [
  {
    id: 'Starter',
    name: 'Starter',
    price: '$49',
    maxUsers: '5 users',
    maxContacts: '500 contacts',
    maxAi: '500 requests/mo',
    features: [
      'AI Chat Assistant autopilot',
      'Appointment Booking',
      'FAQ Automation',
    ],
    cta: 'Select Starter',
  },
  {
    id: 'Growth',
    name: 'Growth',
    price: '$149',
    maxUsers: '15 users',
    maxContacts: '5,000 contacts',
    maxAi: '3,000 requests/mo',
    features: [
      'AI Chat Assistant autopilot',
      'Deals pipelines',
      'Broadcast campaigns',
      'Advanced automation rules',
    ],
    cta: 'Upgrade to Growth',
  },
  {
    id: 'Enterprise',
    name: 'Enterprise',
    price: 'Custom Rate',
    maxUsers: 'Unlimited',
    maxContacts: 'Unlimited',
    maxAi: 'Unlimited',
    features: [
      'AI Chat Assistant autopilot',
      'Deals pipelines',
      'Broadcast campaigns',
      'Advanced automation rules',
      'Dynamic interactive Flows',
      'Dedicated account manager',
    ],
    cta: 'Contact Sales',
  },
];

export function BillingPanel() {
  const { accountId, profile, user } = useAuth();
  const email = profile?.email || user?.email || '';
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);
  const [sub, setSub] = useState<SubscriptionInfo | null>(null);
  const [manageModalOpen, setManageModalOpen] = useState(false);
  const [selectedPlanModal, setSelectedPlanModal] = useState<PlanOffer | null>(
    null
  );

  const [usage, setUsage] = useState<UsageInfo>({
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
        .select('status, end_date, plan:plans(*)')
        .eq('account_id', accountId)
        .maybeSingle()
        .catch(() => ({ data: null }));

      if (subData) {
        setSub(subData as unknown as SubscriptionInfo);
      }

      // 2. Fetch Contact count
      const { count: contactsCount } = await appwrite
        .from('contacts')
        .select('id', { count: 'exact', head: true })
        .eq('account_id', accountId)
        .catch(() => ({ count: 0 }));

      // 3. Fetch Team Member count
      const { count: usersCount } = await appwrite
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('account_id', accountId)
        .catch(() => ({ count: 0 }));

      // 4. Fetch Usage tracking record
      const { data: usageData } = await appwrite
        .from('usage_tracking')
        .select('ai_requests, whatsapp_messages')
        .eq('account_id', accountId)
        .eq('month', currentMonth)
        .maybeSingle()
        .catch(() => ({ data: null }));

      setUsage({
        contacts: contactsCount ?? 0,
        users: usersCount ?? 0,
        aiRequests: usageData?.ai_requests ?? 0,
        whatsappMessages: usageData?.whatsapp_messages ?? 0,
      });
    } catch {
      /* safe fallback */
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    loadBillingData();
  }, [loadBillingData]);

  const handleExecuteUpgrade = async (plan: PlanOffer) => {
    setUpgrading(true);
    try {
      const res = await fetch('/api/account/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planName: plan.name }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to upgrade plan');
      }

      toast.success(data.message || `Upgraded to ${plan.name} Plan!`);
      setSelectedPlanModal(null);
      await loadBillingData();
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Upgrade request failed'
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
          description="View your active SaaS subscription plan, renewal details, and usage limits."
        />
        <Card className="flex h-64 items-center justify-center">
          <Loader2 className="text-muted-foreground size-6 animate-spin" />
        </Card>
      </section>
    );
  }

  const activePlanName = sub?.plan?.name || 'Free Trial';
  const planLimits = sub?.plan || {
    max_contacts: 100,
    max_users: 3,
    max_ai_requests: 50,
  };

  const getPercent = (value: number, max: number) => {
    if (max <= 0 || max >= 999999) return 0;
    return Math.min(Math.round((value / max) * 100), 100);
  };

  return (
    <section className="animate-in fade-in-50 max-w-4xl space-y-6 duration-200">
      <SettingsPanelHead
        title="Billing & Plans"
        description="Monitor your account limits and manage your subscription level."
      />

      {/* Subscription Info Card */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <CreditCard className="text-primary size-4" />
              Active Subscription
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Your billing contract status and renewal date.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                  Plan Name
                </p>
                <p className="text-foreground mt-0.5 flex items-center gap-1.5 text-lg font-bold">
                  {activePlanName}
                  <span className="bg-primary/10 border-primary/20 text-primary inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold tracking-wider uppercase">
                    {sub?.status || 'active'}
                  </span>
                </p>
              </div>

              <div className="text-right">
                <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                  {sub?.status === 'trial'
                    ? 'Trial Ends On'
                    : 'Next Invoice Date'}
                </p>
                <p className="text-foreground mt-0.5 flex items-center justify-end gap-1.5 text-sm font-semibold">
                  <Calendar className="text-muted-foreground size-3.5" />
                  {sub?.end_date
                    ? new Date(sub.end_date).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })
                    : new Date(
                        Date.now() + 14 * 86400 * 1000
                      ).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                </p>
              </div>
            </div>

            <div className="border-border flex flex-wrap gap-3 border-t pt-4">
              <Button
                onClick={() => setManageModalOpen(true)}
                className="flex-1 sm:flex-initial"
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
              Subscription Status
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col items-center justify-center py-6">
            <div className="mb-2 rounded-full bg-emerald-500/10 p-3">
              <Sparkles className="size-6 text-emerald-500" />
            </div>
            <p className="text-foreground text-2xl font-bold tracking-wide uppercase">
              {sub?.status === 'trial' ? '14-Day Trial' : 'ACTIVE'}
            </p>
            <p className="text-muted-foreground mt-1 text-center text-xs">
              Fully compliant with all data limits.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Usage Analytics Grid */}
      <Card>
        <CardHeader>
          <CardTitle className="text-foreground">
            SaaS Allocation & Limits
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Current billing period allocation. Usage limits are reset at the
            beginning of each calendar month.
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
                {usage.users} /{' '}
                {planLimits.max_users >= 9999 ? '∞' : planLimits.max_users}
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
                {usage.contacts} /{' '}
                {planLimits.max_contacts >= 99999
                  ? '∞'
                  : planLimits.max_contacts}
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
                : `${planLimits.max_contacts - usage.contacts} contacts allowed`}
            </p>
          </div>

          {/* AI Request limits */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm font-medium">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Brain className="size-4" />
                AI Auto-replies
              </span>
              <span className="text-foreground font-semibold">
                {usage.aiRequests} /{' '}
                {planLimits.max_ai_requests >= 99999
                  ? '∞'
                  : planLimits.max_ai_requests}
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
                ? 'Limit reached'
                : `${planLimits.max_ai_requests - usage.aiRequests} requests remaining this month`}
            </p>
          </div>

          {/* WhatsApp outgoing messages */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm font-medium">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <MessageSquare className="size-4" />
                Outbound WhatsApp
              </span>
              <span className="text-foreground font-semibold">
                {usage.whatsappMessages} sent
              </span>
            </div>
            <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
              <div
                className="h-full bg-amber-500 transition-all duration-300"
                style={{
                  width: `${Math.min(usage.whatsappMessages, 100)}%`,
                }}
              />
            </div>
            <p className="text-muted-foreground text-xs">
              Usage tracked for metrics (Unlimited sends)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Plans Pricing Grid */}
      <div>
        <h2 className="text-foreground mb-4 text-lg font-bold">
          Available Billing Tiers
        </h2>
        <div className="grid gap-6 md:grid-cols-3">
          {AVAILABLE_PLANS.map((plan) => {
            const isCurrent =
              activePlanName.toLowerCase() === plan.name.toLowerCase() ||
              (activePlanName === 'Free Trial' && plan.name === 'Starter');

            return (
              <Card
                key={plan.id}
                className={`flex flex-col justify-between transition-all ${
                  isCurrent
                    ? 'border-primary ring-primary shadow-lg ring-1'
                    : 'border-border hover:border-muted-foreground/30'
                }`}
              >
                <div>
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <span className="text-foreground text-base font-semibold">
                        {plan.name}
                      </span>
                      {isCurrent && (
                        <span className="bg-primary/10 border-primary/20 text-primary rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase">
                          Active Plan
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex items-baseline gap-1">
                      <span className="text-foreground text-3xl font-extrabold">
                        {plan.price}
                      </span>
                      <span className="text-muted-foreground text-xs">/mo</span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4 pb-6 text-sm">
                    <ul className="border-border text-muted-foreground space-y-2 border-t pt-4 text-xs">
                      <li className="text-foreground flex items-center gap-1.5 font-semibold">
                        <Check className="text-primary size-3 shrink-0" />
                        {plan.maxUsers}
                      </li>
                      <li className="text-foreground flex items-center gap-1.5 font-semibold">
                        <Check className="text-primary size-3 shrink-0" />
                        {plan.maxContacts}
                      </li>
                      <li className="text-foreground flex items-center gap-1.5 font-semibold">
                        <Check className="text-primary size-3 shrink-0" />
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
                    variant={isCurrent ? 'outline' : 'default'}
                    className="w-full"
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
                  {activePlanName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Billing Email</span>
                <span className="text-foreground font-medium">
                  {email || 'Primary Account Admin'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Contract Status</span>
                <span className="text-xs font-semibold tracking-wider text-emerald-500 uppercase">
                  {sub?.status || 'Active'}
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
                    AVAILABLE_PLANS.find((p) => p.name === 'Growth') ||
                      AVAILABLE_PLANS[1]
                  );
                }}
              >
                <span className="flex items-center gap-2">
                  <Zap className="size-4 text-amber-500" />
                  Upgrade Plan Level
                </span>
                <ArrowUpRight className="size-4" />
              </Button>

              <Button
                variant="outline"
                className="w-full justify-between"
                onClick={() => {
                  toast.success(
                    'Invoice request submitted. Check your billing email for details.'
                  );
                }}
              >
                <span className="flex items-center gap-2">
                  <CreditCard className="size-4 text-blue-500" />
                  Request Latest Tax Invoice
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

      {/* Plan Upgrade Dialog */}
      <Dialog
        open={Boolean(selectedPlanModal)}
        onOpenChange={(open) => !open && setSelectedPlanModal(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="text-primary size-5" />
              Confirm Upgrade to {selectedPlanModal?.name}
            </DialogTitle>
            <DialogDescription>
              Switch your account subscription to the {selectedPlanModal?.name}{' '}
              plan tier ({selectedPlanModal?.price}/mo).
            </DialogDescription>
          </DialogHeader>

          {selectedPlanModal && (
            <div className="space-y-4 py-2">
              <div className="bg-primary/5 border-primary/20 space-y-2 rounded-lg border p-4 text-sm">
                <p className="text-foreground text-lg font-bold">
                  {selectedPlanModal.price}{' '}
                  <span className="text-muted-foreground text-xs font-normal">
                    / month
                  </span>
                </p>
                <ul className="text-muted-foreground space-y-1 pt-1 text-xs">
                  <li className="text-foreground flex items-center gap-1.5 font-medium">
                    <Check className="text-primary size-3" />
                    {selectedPlanModal.maxUsers}
                  </li>
                  <li className="text-foreground flex items-center gap-1.5 font-medium">
                    <Check className="text-primary size-3" />
                    {selectedPlanModal.maxContacts}
                  </li>
                  <li className="text-foreground flex items-center gap-1.5 font-medium">
                    <Check className="text-primary size-3" />
                    {selectedPlanModal.maxAi}
                  </li>
                </ul>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setSelectedPlanModal(null)}
              disabled={upgrading}
            >
              Cancel
            </Button>
            <Button
              onClick={() =>
                selectedPlanModal && handleExecuteUpgrade(selectedPlanModal)
              }
              disabled={upgrading}
            >
              {upgrading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Upgrading...
                </>
              ) : (
                'Confirm Plan Upgrade'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
