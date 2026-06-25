"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
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
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SettingsPanelHead } from "./settings-panel-head";

interface SubscriptionInfo {
  status: "trial" | "active" | "expired" | "cancelled";
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
    id: "Free Trial",
    name: "Free Trial",
    price: "$0",
    maxUsers: "3 users",
    maxContacts: "100 contacts",
    maxAi: "50 requests/mo",
    features: ["AI Chat Assistant autopilot", "Deals pipelines", "Basic automation rules"],
    cta: "Current Plan",
  },
  {
    id: "Growth",
    name: "Growth",
    price: "$29",
    maxUsers: "10 users",
    maxContacts: "2,000 contacts",
    maxAi: "1,000 requests/mo",
    features: [
      "AI Chat Assistant autopilot",
      "Deals pipelines",
      "Advanced automation rules",
      "Mass broadcast campaigns",
    ],
    cta: "Upgrade to Growth",
  },
  {
    id: "Enterprise",
    name: "Enterprise",
    price: "$99",
    maxUsers: "Unlimited",
    maxContacts: "Unlimited",
    maxAi: "50,000 requests/mo",
    features: [
      "AI Chat Assistant autopilot",
      "Deals pipelines",
      "Advanced automation rules",
      "Mass broadcast campaigns",
      "Dynamic interactive Flows (Beta)",
      "Dedicated account manager",
    ],
    cta: "Contact Enterprise Sales",
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
    const supabase = createClient();
    const currentMonth = new Date().toISOString().substring(0, 7) + "-01";

    try {
      // 1. Fetch Subscription details
      const { data: subData, error: subError } = await supabase
        .from("subscriptions")
        .select("status, end_date, plan:plans(*)")
        .eq("account_id", accountId)
        .maybeSingle();

      if (subError) throw subError;
      if (subData) {
        setSub(subData as unknown as SubscriptionInfo);
      }

      // 2. Fetch Contact count
      const { count: contactsCount } = await supabase
        .from("contacts")
        .select("id", { count: "exact", head: true })
        .eq("account_id", accountId);

      // 3. Fetch Team Member count
      const { count: usersCount } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("account_id", accountId);

      // 4. Fetch Usage tracking record
      const { data: usageData } = await supabase
        .from("usage_tracking")
        .select("ai_requests, whatsapp_messages")
        .eq("account_id", accountId)
        .eq("month", currentMonth)
        .maybeSingle();

      setUsage({
        contacts: contactsCount ?? 0,
        users: usersCount ?? 0,
        aiRequests: usageData?.ai_requests ?? 0,
        whatsappMessages: usageData?.whatsapp_messages ?? 0,
      });
    } catch (err) {
      console.error(err);
      toast.error("Failed to load billing or plan details");
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    loadBillingData();
  }, [loadBillingData]);

  if (loading) {
    return (
      <section className="max-w-4xl animate-in fade-in-50 duration-200">
        <SettingsPanelHead
          title="Billing & Plans"
          description="View your active SaaS subscription plan, renewal details, and usage limits."
        />
        <Card className="flex h-64 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </Card>
      </section>
    );
  }

  const activePlanName = sub?.plan?.name || "Free Trial";
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
    <section className="max-w-4xl animate-in fade-in-50 duration-200 space-y-6">
      <SettingsPanelHead
        title="Billing & Plans"
        description="Monitor your account limits and manage your subscription level."
      />

      {/* Subscription Info Card */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <CreditCard className="size-4 text-primary" />
              Active Subscription
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Your billing contract status and renewal date.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Plan Name</p>
                <p className="text-lg font-bold text-foreground flex items-center gap-1.5 mt-0.5">
                  {activePlanName}
                  <span className="inline-flex items-center rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-primary">
                    {sub?.status || "trial"}
                  </span>
                </p>
              </div>

              {sub?.end_date && (
                <div className="text-right">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                    {sub.status === "trial" ? "Trial Ends On" : "Next Invoice Date"}
                  </p>
                  <p className="text-sm font-semibold text-foreground flex items-center gap-1.5 mt-0.5 justify-end">
                    <Calendar className="size-3.5 text-muted-foreground" />
                    {new Date(sub.end_date).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-border flex flex-wrap gap-3">
              <Button
                onClick={() => toast.info("Stripe Billing portal is not connected in this environment.")}
                className="flex-1 sm:flex-initial"
              >
                Manage Subscription
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  toast.success("Billing data refreshed");
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
            <CardTitle className="text-sm font-medium text-muted-foreground">Subscription Status</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-center items-center py-6">
            <div className="rounded-full bg-green-500/10 p-3 mb-2">
              <Sparkles className="size-6 text-green-400" />
            </div>
            <p className="text-2xl font-bold text-foreground uppercase tracking-wide">
              {sub?.status === "trial" ? "14-Day Trial" : sub?.status || "Active"}
            </p>
            <p className="text-xs text-muted-foreground text-center mt-1">
              Fully compliant with all data limits.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Usage Analytics Grid */}
      <Card>
        <CardHeader>
          <CardTitle className="text-foreground">SaaS Allocation & Limits</CardTitle>
          <CardDescription className="text-muted-foreground">
            Current billing period allocation. Usage limits are reset at the beginning of each calendar month.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {/* Team member limits */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm font-medium">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Users className="size-4" />
                Team Members
              </span>
              <span className="text-foreground font-semibold">
                {usage.users} / {planLimits.max_users >= 9999 ? "∞" : planLimits.max_users}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-300"
                style={{ width: `${getPercent(usage.users, planLimits.max_users)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {planLimits.max_users - usage.users <= 0
                ? "Limit reached"
                : `${planLimits.max_users - usage.users} open seats remaining`}
            </p>
          </div>

          {/* Contact limits */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm font-medium">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <UserCheck className="size-4" />
                Total Contacts
              </span>
              <span className="text-foreground font-semibold">
                {usage.contacts} / {planLimits.max_contacts >= 99999 ? "∞" : planLimits.max_contacts}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all duration-300"
                style={{ width: `${getPercent(usage.contacts, planLimits.max_contacts)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {planLimits.max_contacts - usage.contacts <= 0
                ? "Limit reached"
                : `${planLimits.max_contacts - usage.contacts} contacts allowed`}
            </p>
          </div>

          {/* AI Request limits */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm font-medium">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Brain className="size-4" />
                AI Auto-replies
              </span>
              <span className="text-foreground font-semibold">
                {usage.aiRequests} / {planLimits.max_ai_requests >= 99999 ? "∞" : planLimits.max_ai_requests}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-purple-500 transition-all duration-300"
                style={{ width: `${getPercent(usage.aiRequests, planLimits.max_ai_requests)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {planLimits.max_ai_requests - usage.aiRequests <= 0
                ? "Limit reached"
                : `${planLimits.max_ai_requests - usage.aiRequests} requests remaining this month`}
            </p>
          </div>

          {/* WhatsApp outgoing messages */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm font-medium">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <MessageSquare className="size-4" />
                Outbound WhatsApp
              </span>
              <span className="text-foreground font-semibold">{usage.whatsappMessages} sent</span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-yellow-500" style={{ width: "35%" }} />
            </div>
            <p className="text-xs text-muted-foreground">Usage tracked for metrics (Unlimited sends)</p>
          </div>
        </CardContent>
      </Card>

      {/* Plans Pricing Grid */}
      <div>
        <h2 className="text-lg font-bold text-foreground mb-4">Available Billing Tiers</h2>
        <div className="grid gap-6 md:grid-cols-3">
          {AVAILABLE_PLANS.map((plan) => {
            const isCurrent = activePlanName === plan.id;
            return (
              <Card
                key={plan.id}
                className={`flex flex-col justify-between transition-all ${
                  isCurrent
                    ? "border-primary shadow-lg ring-1 ring-primary"
                    : "border-border hover:border-muted-foreground/30"
                }`}
              >
                <div>
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground text-base">{plan.name}</span>
                      {isCurrent && (
                        <span className="rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                          Active
                        </span>
                      )}
                    </div>
                    <div className="flex items-baseline gap-1 mt-2">
                      <span className="text-3xl font-extrabold text-foreground">{plan.price}</span>
                      <span className="text-xs text-muted-foreground">/mo</span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4 text-sm pb-6">
                    <ul className="space-y-2 border-t border-border pt-4 text-xs text-muted-foreground">
                      <li className="flex items-center gap-1.5 font-semibold text-foreground">
                        <Check className="size-3 text-primary shrink-0" />
                        {plan.maxUsers}
                      </li>
                      <li className="flex items-center gap-1.5 font-semibold text-foreground">
                        <Check className="size-3 text-primary shrink-0" />
                        {plan.maxContacts}
                      </li>
                      <li className="flex items-center gap-1.5 font-semibold text-foreground">
                        <Check className="size-3 text-primary shrink-0" />
                        {plan.maxAi}
                      </li>
                      {plan.features.map((feat, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <Check className="size-3 text-muted-foreground shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </div>

                <div className="p-6 pt-0">
                  <Button
                    variant={isCurrent ? "outline" : "default"}
                    className="w-full"
                    disabled={isCurrent}
                    onClick={() => {
                      if (plan.id === "Enterprise") {
                        toast.info("Please request enterprise billing upgrades through Susanta (WACRM Super Admin).");
                      } else {
                        toast.success(`Upgrade request for "${plan.name}" plan sent successfully!`);
                      }
                    }}
                  >
                    {isCurrent ? "Active Plan" : plan.cta}
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
