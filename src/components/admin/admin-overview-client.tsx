'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  Building2,
  CreditCard,
  Sparkles,
  MessageCircle,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Plus,
  Settings,
  Bot,
  Loader2,
  Check,
  ChevronRight,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import { AdminNav } from './admin-nav';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';

interface AdminMetrics {
  totalAccounts: number;
  totalUsers: number;
  subscriptions: {
    active: number;
    trial: number;
    expired: number;
    total: number;
    planBreakdown: Record<string, number>;
  };
  usage: {
    month: string;
    aiRequests: number;
    whatsappMessages: number;
  };
}

interface RevenueData {
  totalRevenue: number;
  setupFeeRevenue: number;
  recurringRevenue: number;
  monthlyRecurringRevenue: number;
  pastDueCount: number;
  activeSubscriptionsCount: number;
  trialCustomersCount: number;
  cancelledCount: number;
  revenueByPlan: Record<string, number>;
  customerCountByPlan: Record<string, number>;
  upgradeRate: number;
  cancellationRate: number;
  recentPayments?: Array<{
    id: string;
    amount: number;
    status: string;
    created_at: string;
    account?: {
      id: string;
      name: string;
    };
  }>;
}

interface TenantItem {
  id: string;
  name: string;
  created_at: string;
  industry?: string;
  owner: {
    full_name: string | null;
    email: string;
  } | null;
  membersCount: number;
  contactsCount: number;
  subscription: {
    status: 'trial' | 'active' | 'expired' | 'cancelled';
    end_date: string | null;
    plan: {
      id: string;
      name: string;
    };
  } | null;
  usage: {
    aiRequests: number;
    whatsappMessages: number;
  };
}

interface AiUsageSummary {
  totalRequests: number;
  totalTokens: number;
  estimatedCostInr: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FORMATTERS
// ═══════════════════════════════════════════════════════════════════════════════

const INDUSTRY_DISPLAY_NAMES: Record<string, string> = {
  hospital_clinic: 'Health & Clinic',
  health: 'Health & Clinic',
  clinic: 'Health & Clinic',
  healthcare: 'Health & Clinic',
  coaching: 'Coaching & Institute',
  institute: 'Coaching & Institute',
  solo_teacher: 'Solo Tutor',
  tutor: 'Solo Tutor',
  teacher: 'Solo Tutor',
  salon: 'Salon & Spa',
  spa: 'Salon & Spa',
  beauty: 'Salon & Spa',
  real_estate: 'Real Estate',
  property: 'Real Estate',
  travel: 'Travel & Tourism',
  gym: 'Gym & Fitness',
  fitness: 'Gym & Fitness',
  restaurant: 'Restaurant & Cafe',
  cafe: 'Restaurant & Cafe',
  general: 'Business Services',
};

function formatIndustry(industry?: string): string {
  if (!industry) return 'Health & Clinic';
  const clean = industry.toLowerCase().replace(/[^a-z0-9_]/g, '_');
  return (
    INDUSTRY_DISPLAY_NAMES[clean] ||
    industry
      .split(/[_-]/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
  );
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

function formatDate(dateStr: string) {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return 'Recent';
  }
}

function getGreetingTime(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

// ═══════════════════════════════════════════════════════════════════════════════
// REUSABLE KPI CARD
// ═══════════════════════════════════════════════════════════════════════════════

function KpiCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = 'primary',
}: {
  label: string;
  value: string | number;
  detail: React.ReactNode;
  icon: LucideIcon;
  tone?: 'primary' | 'blue' | 'purple' | 'emerald';
}) {
  const toneClasses = {
    primary: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    purple: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  };

  return (
    <div className="group border-border/60 bg-card/80 relative overflow-hidden rounded-[1.35rem] border p-5 shadow-[0_18px_50px_-30px_rgba(15,23,42,0.45)] transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-500/30 hover:shadow-lg">
      <div className="bg-primary/5 absolute -top-8 -right-8 h-24 w-24 rounded-full blur-2xl transition-transform duration-300 group-hover:scale-125" />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-muted-foreground text-[10px] font-bold tracking-[0.16em] uppercase">
            {label}
          </p>
          <p className="text-foreground mt-3 text-3xl font-bold tracking-tight tabular-nums">
            {value}
          </p>
          <div className="text-muted-foreground mt-1 text-xs">{detail}</div>
        </div>
        <div className={cn('rounded-xl p-2.5', toneClasses[tone])}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN SUPER ADMIN DASHBOARD COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function AdminOverviewClient() {
  const { profile, user } = useAuth();
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [revenue, setRevenue] = useState<RevenueData | null>(null);
  const [tenants, setTenants] = useState<TenantItem[]>([]);
  const [aiUsage, setAiUsage] = useState<AiUsageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOverviewData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [metricsRes, revenueRes, tenantsRes, aiRes] = await Promise.all([
        fetch('/api/admin/metrics'),
        fetch('/api/admin/revenue'),
        fetch('/api/admin/tenants'),
        fetch('/api/admin/ai/usage').catch(() => null),
      ]);

      if (!metricsRes.ok) {
        throw new Error('Failed to fetch platform metrics');
      }

      const metricsData = await metricsRes.json();
      setMetrics(metricsData);

      if (revenueRes.ok) {
        const revenueData = await revenueRes.json();
        setRevenue(revenueData);
      }

      if (tenantsRes.ok) {
        const tenantsData = await tenantsRes.json();
        setTenants(Array.isArray(tenantsData) ? tenantsData : []);
      }

      if (aiRes && aiRes.ok) {
        const aiData = await aiRes.json();
        setAiUsage({
          totalRequests: aiData.totalRequests || 0,
          totalTokens: aiData.totalTokens || 0,
          estimatedCostInr: aiData.estimatedCostInr || 0,
        });
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Something went wrong while loading your dashboard.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverviewData();
  }, [fetchOverviewData]);

  // Compute greeting name
  const adminName = useMemo(() => {
    const raw = profile?.full_name || user?.name || '';
    if (raw.trim()) {
      return raw.trim().split(' ')[0];
    }
    return 'Susanta';
  }, [profile?.full_name, user?.name]);

  // Compute attention items based on actual data
  const attentionItems = useMemo(() => {
    const items: Array<{
      id: string;
      title: string;
      description: string;
      href: string;
      actionLabel: string;
    }> = [];

    if (revenue?.pastDueCount && revenue.pastDueCount > 0) {
      items.push({
        id: 'past_due',
        title: `${revenue.pastDueCount} subscription payment${revenue.pastDueCount > 1 ? 's are' : ' is'} pending`,
        description:
          'Accounts have unpaid invoices or past-due renewal status.',
        href: '/admin/plans',
        actionLabel: 'View Subscriptions',
      });
    }

    if (metrics?.subscriptions?.expired && metrics.subscriptions.expired > 0) {
      items.push({
        id: 'expired_subs',
        title: `${metrics.subscriptions.expired} business account${metrics.subscriptions.expired > 1 ? 's have' : ' has'} expired`,
        description: 'Trial periods ended or plans were discontinued.',
        href: '/admin/subscribers',
        actionLabel: 'View Businesses',
      });
    }

    return items;
  }, [revenue?.pastDueCount, metrics?.subscriptions?.expired]);

  // Recent 5 businesses
  const recentBusinesses = useMemo(() => {
    return tenants.slice(0, 5);
  }, [tenants]);

  // Recent activity list derived from real transactions / audit records
  const recentActivities = useMemo(() => {
    const list: Array<{
      id: string;
      title: string;
      subtitle: string;
      time: string;
    }> = [];

    if (revenue?.recentPayments && revenue.recentPayments.length > 0) {
      revenue.recentPayments.slice(0, 4).forEach((p) => {
        const businessName = p.account?.name || 'Subscribed Business';
        list.push({
          id: p.id,
          title: `Payment of ${formatCurrency(p.amount)} received`,
          subtitle: `From ${businessName} • Status: ${p.status.toLowerCase()}`,
          time: formatDate(p.created_at),
        });
      });
    }

    // Add milestone items from recent tenants
    if (tenants.length > 0 && list.length < 4) {
      tenants.slice(0, 4 - list.length).forEach((t) => {
        list.push({
          id: `joined-${t.id}`,
          title: `${t.name} registered on Helpa`,
          subtitle: `Industry: ${formatIndustry(t.industry)} • ${t.subscription?.plan?.name || 'Growth Plan'}`,
          time: formatDate(t.created_at),
        });
      });
    }

    return list;
  }, [revenue?.recentPayments, tenants]);

  return (
    <AdminNav onRefresh={fetchOverviewData} loading={loading}>
      {error ? (
        <div className="border-destructive/20 bg-destructive/10 text-destructive flex items-center justify-between gap-3 rounded-2xl border p-5 text-xs">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <div>
              <p className="text-sm font-semibold">
                Unable to load dashboard data
              </p>
              <p className="mt-0.5 opacity-90">{error}</p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={fetchOverviewData}
            className="h-8 rounded-lg text-xs"
          >
            Try Again
          </Button>
        </div>
      ) : loading ? (
        <div className="flex min-h-[400px] flex-col items-center justify-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600 dark:text-emerald-400" />
          <p className="text-muted-foreground text-xs font-medium">
            Loading Helpa Business Control Center...
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* 1. WELCOME HEADER */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          <div className="border-border/60 bg-card/70 relative overflow-hidden rounded-2xl border p-5 shadow-xs">
            <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-foreground text-lg font-bold tracking-tight sm:text-xl">
                  {getGreetingTime()}, {adminName} 👋
                </h2>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  Here&apos;s what&apos;s happening with Helpa today.
                </p>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                  Live Platform Status
                </span>
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* 2. TOP BUSINESS KPI METRICS */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {/* 1. Total Businesses */}
            <KpiCard
              label="Businesses"
              value={metrics?.totalAccounts ?? tenants.length}
              tone="primary"
              icon={Building2}
              detail={
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    {metrics?.subscriptions?.active ?? tenants.length} active
                  </span>
                  <span>•</span>
                  <span>{metrics?.subscriptions?.trial ?? 0} trials</span>
                </div>
              }
            />

            {/* 2. Active Paying Businesses */}
            <KpiCard
              label="Active Subscribers"
              value={metrics?.subscriptions?.active ?? tenants.length}
              tone="emerald"
              icon={CheckCircle2}
              detail={
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  {revenue?.activeSubscriptionsCount ??
                    metrics?.subscriptions?.active ??
                    tenants.length}{' '}
                  paying businesses
                </span>
              }
            />

            {/* 3. Monthly Recurring Revenue */}
            <KpiCard
              label="Monthly Revenue"
              value={formatCurrency(revenue?.monthlyRecurringRevenue ?? 0)}
              tone="blue"
              icon={CreditCard}
              detail={
                <span className="text-muted-foreground">
                  {revenue?.pastDueCount
                    ? `${revenue.pastDueCount} pending payment`
                    : 'All accounts in good standing'}
                </span>
              }
            />

            {/* 4. AI Usage */}
            <KpiCard
              label="AI Usage"
              value={(metrics?.usage?.aiRequests ?? 0).toLocaleString()}
              tone="purple"
              icon={Sparkles}
              detail={
                <span className="font-medium text-purple-600 dark:text-purple-400">
                  Calls this month
                </span>
              }
            />

            {/* 5. WhatsApp Connections */}
            <KpiCard
              label="WhatsApp Dispatches"
              value={(metrics?.usage?.whatsappMessages ?? 0).toLocaleString()}
              tone="emerald"
              icon={MessageCircle}
              detail={
                <span className="font-medium text-emerald-600 dark:text-emerald-400">
                  Messages processed
                </span>
              }
            />
          </div>

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* 3. NEEDS YOUR ATTENTION */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          <div className="space-y-3">
            <h3 className="text-foreground text-xs font-bold tracking-wider uppercase">
              Needs Your Attention
            </h3>

            {attentionItems.length > 0 ? (
              <div className="space-y-2.5">
                {attentionItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col justify-between gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 sm:flex-row sm:items-center"
                  >
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                      <div>
                        <p className="text-foreground text-xs font-semibold">
                          {item.title}
                        </p>
                        <p className="text-muted-foreground mt-0.5 text-[11px]">
                          {item.description}
                        </p>
                      </div>
                    </div>
                    <Link href={item.href}>
                      <Button
                        size="sm"
                        variant="outline"
                        className="bg-background/80 h-7 rounded-lg border-amber-500/30 text-xs font-medium hover:bg-amber-500/20"
                      >
                        {item.actionLabel}{' '}
                        <ArrowRight className="ml-1.5 h-3 w-3" />
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-between rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs">
                <div className="flex items-center gap-3">
                  <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <div>
                    <span className="font-semibold text-emerald-800 dark:text-emerald-300">
                      Everything looks good
                    </span>
                    <p className="mt-0.5 text-[11px] text-emerald-700/90 dark:text-emerald-400">
                      No urgent issues right now. All platform services,
                      WhatsApp gateways, and subscriptions are operating
                      normally.
                    </p>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className="hidden border-emerald-500/30 bg-emerald-500/20 font-semibold text-emerald-700 sm:inline-flex dark:text-emerald-300"
                >
                  Operational
                </Badge>
              </div>
            )}
          </div>

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* 4. QUICK ACTIONS */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          <div className="space-y-3">
            <h3 className="text-foreground text-xs font-bold tracking-wider uppercase">
              Quick Actions
            </h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Link href="/admin/subscribers" className="group">
                <div className="border-border/60 bg-card/80 flex items-center justify-between rounded-2xl border p-3.5 shadow-xs transition-all duration-150 hover:-translate-y-0.5 hover:border-emerald-500/30 hover:shadow-md">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      <Plus className="h-4 w-4" />
                    </div>
                    <span className="text-foreground text-xs font-semibold">
                      Add Business
                    </span>
                  </div>
                  <ChevronRight className="text-muted-foreground group-hover:text-foreground h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </div>
              </Link>

              <Link href="/admin/plans" className="group">
                <div className="border-border/60 bg-card/80 flex items-center justify-between rounded-2xl border p-3.5 shadow-xs transition-all duration-150 hover:-translate-y-0.5 hover:border-emerald-500/30 hover:shadow-md">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                      <CreditCard className="h-4 w-4" />
                    </div>
                    <span className="text-foreground text-xs font-semibold">
                      Plans & Pricing
                    </span>
                  </div>
                  <ChevronRight className="text-muted-foreground group-hover:text-foreground h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </div>
              </Link>

              <Link href="/admin/ai" className="group">
                <div className="border-border/60 bg-card/80 flex items-center justify-between rounded-2xl border p-3.5 shadow-xs transition-all duration-150 hover:-translate-y-0.5 hover:border-emerald-500/30 hover:shadow-md">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                      <Bot className="h-4 w-4" />
                    </div>
                    <span className="text-foreground text-xs font-semibold">
                      AI Settings
                    </span>
                  </div>
                  <ChevronRight className="text-muted-foreground group-hover:text-foreground h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </div>
              </Link>

              <Link href="/admin/settings" className="group">
                <div className="border-border/60 bg-card/80 flex items-center justify-between rounded-2xl border p-3.5 shadow-xs transition-all duration-150 hover:-translate-y-0.5 hover:border-emerald-500/30 hover:shadow-md">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-500/10 text-slate-600 dark:text-slate-400">
                      <Settings className="h-4 w-4" />
                    </div>
                    <span className="text-foreground text-xs font-semibold">
                      System Settings
                    </span>
                  </div>
                  <ChevronRight className="text-muted-foreground group-hover:text-foreground h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </div>
              </Link>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* 5. RECENT BUSINESSES TABLE */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          <div className="border-border/60 bg-card/80 rounded-[1.35rem] border shadow-[0_18px_50px_-30px_rgba(15,23,42,0.45)]">
            <div className="border-border/60 flex items-center justify-between border-b p-5">
              <div>
                <h3 className="text-foreground text-sm font-semibold">
                  Recent Businesses
                </h3>
                <p className="text-muted-foreground text-xs">
                  Latest registered organizations on Helpa
                </p>
              </div>
              <Link href="/admin/subscribers">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-foreground h-8 gap-1.5 rounded-xl text-xs font-medium"
                >
                  View All Businesses <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>

            {recentBusinesses.length === 0 ? (
              <div className="p-10 text-center">
                <Building2 className="text-muted-foreground/40 mx-auto h-8 w-8" />
                <p className="text-foreground mt-2 text-xs font-semibold">
                  No businesses yet
                </p>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  Businesses that join Helpa will appear here.
                </p>
                <Link href="/admin/subscribers" className="mt-3 inline-block">
                  <Button size="sm" className="h-8 rounded-xl text-xs">
                    <Plus className="mr-1 h-3.5 w-3.5" /> Add Business
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-border/60 bg-muted/30 text-muted-foreground border-b text-[11px] font-semibold">
                    <tr>
                      <th className="px-5 py-3">Business</th>
                      <th className="px-5 py-3">Industry</th>
                      <th className="px-5 py-3">Plan</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3">Joined</th>
                      <th className="px-5 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-border/40 divide-y">
                    {recentBusinesses.map((b) => {
                      const subStatus = b.subscription?.status || 'active';
                      const planName =
                        b.subscription?.plan?.name || 'Growth Plan';

                      return (
                        <tr
                          key={b.id}
                          className="hover:bg-muted/20 transition-colors"
                        >
                          <td className="px-5 py-3.5">
                            <div className="text-foreground font-semibold">
                              {b.name}
                            </div>
                            <div className="text-muted-foreground text-[11px]">
                              {b.owner?.full_name || 'Account Owner'}
                            </div>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="text-muted-foreground font-medium">
                              {formatIndustry(b.industry)}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="text-foreground font-medium">
                              {planName}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            {subStatus === 'active' ? (
                              <Badge
                                variant="outline"
                                className="border-emerald-500/30 bg-emerald-500/10 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400"
                              >
                                ● Active
                              </Badge>
                            ) : subStatus === 'trial' ? (
                              <Badge
                                variant="outline"
                                className="border-amber-500/30 bg-amber-500/10 text-[10px] font-semibold text-amber-600 dark:text-amber-400"
                              >
                                ● Trial
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="border-rose-500/30 bg-rose-500/10 text-[10px] font-semibold text-rose-600 dark:text-rose-400"
                              >
                                ● Expired
                              </Badge>
                            )}
                          </td>
                          <td className="text-muted-foreground px-5 py-3.5">
                            {formatDate(b.created_at)}
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <Link href="/admin/subscribers">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 rounded-lg px-2.5 text-[11px] font-medium"
                              >
                                View
                              </Button>
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* 6. REVENUE & PLANS BREAKDOWN */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Revenue Overview Card */}
            <div className="border-border/60 bg-card/80 rounded-[1.35rem] border p-5 shadow-[0_18px_50px_-30px_rgba(15,23,42,0.45)]">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-foreground flex items-center gap-2 text-sm font-semibold">
                    <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    Revenue Overview
                  </h3>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    Helpa revenue distribution & collection
                  </p>
                </div>
                <Link href="/admin/plans">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-foreground h-7 rounded-lg text-xs"
                  >
                    Details <ArrowRight className="ml-1 h-3 w-3" />
                  </Button>
                </Link>
              </div>

              <div className="bg-muted/30 mt-5 grid grid-cols-3 gap-3 rounded-2xl p-3.5 text-center">
                <div>
                  <div className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                    Monthly MRR
                  </div>
                  <div className="text-foreground mt-1 text-sm font-bold">
                    {formatCurrency(revenue?.monthlyRecurringRevenue ?? 0)}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                    Setup Fees
                  </div>
                  <div className="text-foreground mt-1 text-sm font-bold">
                    {formatCurrency(revenue?.setupFeeRevenue ?? 0)}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                    Total Revenue
                  </div>
                  <div className="mt-1 text-sm font-bold text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(revenue?.totalRevenue ?? 0)}
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    Paying Subscribers
                  </span>
                  <span className="text-foreground font-semibold">
                    {revenue?.activeSubscriptionsCount ??
                      metrics?.subscriptions?.active ??
                      0}{' '}
                    businesses
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    Active Trial Accounts
                  </span>
                  <span className="text-foreground font-semibold">
                    {revenue?.trialCustomersCount ??
                      metrics?.subscriptions?.trial ??
                      0}{' '}
                    trials
                  </span>
                </div>
              </div>
            </div>

            {/* Plan Distribution Card */}
            <div className="border-border/60 bg-card/80 rounded-[1.35rem] border p-5 shadow-[0_18px_50px_-30px_rgba(15,23,42,0.45)]">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-foreground text-sm font-semibold">
                    Plans
                  </h3>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    Subscriber distribution by plan tier
                  </p>
                </div>
                <Link href="/admin/plans">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-foreground h-7 rounded-lg text-xs"
                  >
                    Manage Plans <ArrowRight className="ml-1 h-3 w-3" />
                  </Button>
                </Link>
              </div>

              <div className="mt-4 space-y-3">
                {/* Starter */}
                <div className="border-border/50 flex items-center justify-between border-b pb-2.5 text-xs">
                  <div>
                    <span className="text-foreground font-semibold">
                      Starter Plan
                    </span>
                    <span className="text-muted-foreground ml-2 text-[11px]">
                      (₹3,499/mo)
                    </span>
                  </div>
                  <Badge
                    variant="outline"
                    className="border-slate-500/20 bg-slate-500/10 text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    {revenue?.customerCountByPlan?.starter ??
                      metrics?.subscriptions?.planBreakdown?.['Starter'] ??
                      0}{' '}
                    businesses
                  </Badge>
                </div>

                {/* Growth ⭐ */}
                <div className="border-border/50 flex items-center justify-between border-b pb-2.5 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="text-foreground font-semibold">
                      Growth Plan ⭐
                    </span>
                    <span className="text-[10px] font-bold text-emerald-600 uppercase dark:text-emerald-400">
                      (Recommended)
                    </span>
                  </div>
                  <Badge
                    variant="outline"
                    className="border-emerald-500/30 bg-emerald-500/10 text-xs font-semibold text-emerald-600 dark:text-emerald-400"
                  >
                    {revenue?.customerCountByPlan?.growth ??
                      metrics?.subscriptions?.planBreakdown?.['Growth'] ??
                      metrics?.subscriptions?.active ??
                      0}{' '}
                    businesses
                  </Badge>
                </div>

                {/* Pro */}
                <div className="flex items-center justify-between pt-0.5 text-xs">
                  <div>
                    <span className="text-foreground font-semibold">
                      Pro Plan
                    </span>
                    <span className="text-muted-foreground ml-2 text-[11px]">
                      (₹7,999/mo)
                    </span>
                  </div>
                  <Badge
                    variant="outline"
                    className="border-purple-500/30 bg-purple-500/10 text-xs font-semibold text-purple-600 dark:text-purple-400"
                  >
                    {revenue?.customerCountByPlan?.pro ??
                      metrics?.subscriptions?.planBreakdown?.['Pro'] ??
                      metrics?.subscriptions?.planBreakdown?.['Enterprise'] ??
                      0}{' '}
                    businesses
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* 7. WHATSAPP & AI OVERVIEW + RECENT ACTIVITY */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* WhatsApp & AI Operational Cards */}
            <div className="space-y-4">
              {/* Helpa AI Card */}
              <div className="border-border/60 bg-card/80 flex flex-col justify-between gap-3 rounded-2xl border p-4 shadow-xs sm:flex-row sm:items-center">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-foreground text-xs font-semibold">
                        Helpa AI
                      </span>
                      <span className="py-0.2 inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                        <span className="h-1 w-1 rounded-full bg-emerald-500" />
                        Working normally
                      </span>
                    </div>
                    <p className="text-muted-foreground mt-0.5 text-[11px]">
                      {(metrics?.usage?.aiRequests ?? 0).toLocaleString()} calls
                      processed • ₹{aiUsage?.estimatedCostInr ?? 0} estimated
                      cost
                    </p>
                  </div>
                </div>
                <Link href="/admin/ai" className="self-start sm:self-auto">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 rounded-lg text-xs font-medium"
                  >
                    AI Settings
                  </Button>
                </Link>
              </div>

              {/* WhatsApp Overview Card */}
              <div className="border-border/60 bg-card/80 flex flex-col justify-between gap-3 rounded-2xl border p-4 shadow-xs sm:flex-row sm:items-center">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <MessageCircle className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-foreground text-xs font-semibold">
                        WhatsApp Connections
                      </span>
                      <span className="py-0.2 inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                        <span className="h-1 w-1 rounded-full bg-emerald-500" />
                        Operational
                      </span>
                    </div>
                    <p className="text-muted-foreground mt-0.5 text-[11px]">
                      {(metrics?.usage?.whatsappMessages ?? 0).toLocaleString()}{' '}
                      messages dispatched across all businesses
                    </p>
                  </div>
                </div>
                <Link
                  href="/admin/subscribers"
                  className="self-start sm:self-auto"
                >
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 rounded-lg text-xs font-medium"
                  >
                    View Businesses
                  </Button>
                </Link>
              </div>
            </div>

            {/* Recent Activity Timeline */}
            <div className="border-border/60 bg-card/80 rounded-[1.35rem] border p-5 shadow-[0_18px_50px_-30px_rgba(15,23,42,0.45)]">
              <div className="border-border/60 flex items-center justify-between border-b pb-3">
                <h3 className="text-foreground text-sm font-semibold">
                  Recent Activity
                </h3>
                <span className="text-muted-foreground text-[11px]">
                  Real-time events
                </span>
              </div>

              {recentActivities.length === 0 ? (
                <div className="text-muted-foreground py-8 text-center text-xs">
                  No recent activity
                </div>
              ) : (
                <div className="mt-3 space-y-3">
                  {recentActivities.map((act) => (
                    <div
                      key={act.id}
                      className="flex items-start justify-between gap-3 text-xs"
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                        <div>
                          <p className="text-foreground font-medium">
                            {act.title}
                          </p>
                          <p className="text-muted-foreground text-[11px]">
                            {act.subtitle}
                          </p>
                        </div>
                      </div>
                      <span className="text-muted-foreground shrink-0 text-[10px]">
                        {act.time}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </AdminNav>
  );
}
