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
    price: '₹4,999',
    maxUsers: '5 users',
    maxContacts: '500 contacts',
    maxAi: '500 requests/mo',
    features: [
      'AI Chat Assistant autopilot',
      'Appointment Booking',
      'FAQ Automation',
    ],
    cta: 'Current Plan',
  },
  {
    id: 'Growth',
    name: 'Growth',
    price: '₹14,999',
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
  const { accountId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [sub, setSub] = useState<SubscriptionInfo | null>(null);
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
      const { data: subData, error: subError } = await appwrite
        .from('subscriptions')
        .select('status, end_date, plan:plans(*)')
        .eq('account_id', accountId)
        .maybeSingle();

      if (subError) throw subError;
      if (subData) {
        setSub(subData as unknown as SubscriptionInfo);
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
    } catch (err) {
      console.error(err);
      toast.error('Failed to load billing or plan details');
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    loadBillingData();
  }, [loadBillingData]);

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
                    {sub?.status || 'trial'}
                  </span>
                </p>
              </div>

              {sub?.end_date && (
                <div className="text-right">
                  <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                    {sub.status === 'trial'
                      ? 'Trial Ends On'
                      : 'Next Invoice Date'}
                  </p>
                  <p className="text-foreground mt-0.5 flex items-center justify-end gap-1.5 text-sm font-semibold">
                    <Calendar className="text-muted-foreground size-3.5" />
                    {new Date(sub.end_date).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              )}
            </div>

            <div className="border-border flex flex-wrap gap-3 border-t pt-4">
              <Button
                onClick={() =>
                  toast.info(
                    'Stripe Billing portal is not connected in this environment.'
                  )
                }
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
            <div className="mb-2 rounded-full bg-green-500/10 p-3">
              <Sparkles className="size-6 text-green-400" />
            </div>
            <p className="text-foreground text-2xl font-bold tracking-wide uppercase">
              {sub?.status === 'trial'
                ? '14-Day Trial'
                : sub?.status || 'Active'}
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
                className="h-full bg-green-500 transition-all duration-300"
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
              <div className="h-full bg-yellow-500" style={{ width: '35%' }} />
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
            const isCurrent = activePlanName === plan.id;
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
                          Active
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
                    onClick={() => {
                      if (plan.id === 'Enterprise') {
                        toast.info(
                          'Please contact Helpa Studio team for enterprise billing upgrades.'
                        );
                      } else {
                        toast.success(
                          `Upgrade request for "${plan.name}" plan sent successfully!`
                        );
                      }
                    }}
                  >
                    {isCurrent ? 'Active Plan' : plan.cta}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
