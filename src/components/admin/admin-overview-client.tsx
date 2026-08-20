'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Users,
  CreditCard,
  Brain,
  TrendingUp,
  MessageSquare,
  Activity,
  ArrowRight,
  Database,
  Zap,
  Cpu,
  Lock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  type LucideIcon,
} from 'lucide-react';
import { AdminNav } from './admin-nav';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
  monthlyRecurringRevenue: number;
  pastDueCount: number;
  activeSubscriptionsCount: number;
  trialCustomersCount: number;
  revenueByPlan: Record<string, number>;
}

function StatCard({
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
    primary: 'bg-primary/10 text-primary',
    blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    purple: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  };

  return (
    <div className="group border-border/60 bg-card/80 hover:border-primary/30 relative overflow-hidden rounded-[1.35rem] border p-5 shadow-[0_18px_50px_-30px_rgba(15,23,42,0.45)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
      <div className="bg-primary/5 absolute -top-8 -right-8 h-24 w-24 rounded-full blur-2xl transition-transform duration-300 group-hover:scale-125" />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-muted-foreground text-[10px] font-bold tracking-[0.16em] uppercase">
            {label}
          </p>
          <p className="text-foreground mt-3 text-3xl font-semibold tracking-tight tabular-nums">
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

export function AdminOverviewClient() {
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [revenue, setRevenue] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOverviewData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [metricsRes, revenueRes] = await Promise.all([
        fetch('/api/admin/metrics'),
        fetch('/api/admin/revenue'),
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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error fetching data';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverviewData();
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  return (
    <AdminNav onRefresh={fetchOverviewData} loading={loading}>
      {error ? (
        <div className="border-destructive/20 bg-destructive/10 text-destructive flex items-center gap-3 rounded-2xl border p-4 text-xs">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
          <Button
            size="sm"
            variant="outline"
            onClick={fetchOverviewData}
            className="ml-auto h-7 rounded-lg text-xs"
          >
            Retry
          </Button>
        </div>
      ) : loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="text-primary h-6 w-6 animate-spin" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Top KPI Metrics Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total Subscribers"
              value={metrics?.totalAccounts ?? 0}
              tone="primary"
              icon={Users}
              detail={
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    {metrics?.subscriptions?.active ?? 0} active
                  </span>
                  <span>•</span>
                  <span>{metrics?.subscriptions?.trial ?? 0} trials</span>
                </div>
              }
            />

            <StatCard
              label="Monthly Recurring Revenue"
              value={formatCurrency(revenue?.monthlyRecurringRevenue ?? 0)}
              tone="blue"
              icon={CreditCard}
              detail={
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-blue-600 dark:text-blue-400">
                    {revenue?.activeSubscriptionsCount ?? 0} paying
                  </span>
                  {Boolean(revenue?.pastDueCount) && (
                    <>
                      <span>•</span>
                      <span className="text-amber-600 dark:text-amber-400">
                        {revenue?.pastDueCount} past due
                      </span>
                    </>
                  )}
                </div>
              }
            />

            <StatCard
              label="Monthly AI Requests"
              value={(metrics?.usage?.aiRequests ?? 0).toLocaleString()}
              tone="purple"
              icon={Brain}
              detail={
                <span className="font-medium text-purple-600 dark:text-purple-400">
                  {metrics?.usage?.month || 'Current Month'}
                </span>
              }
            />

            <StatCard
              label="WhatsApp Messages"
              value={(metrics?.usage?.whatsappMessages ?? 0).toLocaleString()}
              tone="emerald"
              icon={MessageSquare}
              detail={
                <span className="font-medium text-emerald-600 dark:text-emerald-400">
                  Outbound + Inbound
                </span>
              }
            />
          </div>

          {/* Platform Status & Infrastructure Diagnostics */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="border-border/60 bg-card/80 flex items-center justify-between rounded-2xl border p-3.5 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <Database className="h-4 w-4" />
                </div>
                <div>
                  <span className="text-muted-foreground text-[11px]">
                    Database Platform
                  </span>
                  <p className="text-foreground flex items-center gap-1 text-xs font-semibold">
                    <CheckCircle2 className="h-3 w-3 text-emerald-500" />{' '}
                    Connected
                  </p>
                </div>
              </div>
              <Badge
                variant="outline"
                className="border-emerald-500/20 bg-emerald-500/10 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400"
              >
                Active
              </Badge>
            </div>

            <div className="border-border/60 bg-card/80 flex items-center justify-between rounded-2xl border p-3.5 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <Zap className="h-4 w-4" />
                </div>
                <div>
                  <span className="text-muted-foreground text-[11px]">
                    WhatsApp Cloud API
                  </span>
                  <p className="text-foreground flex items-center gap-1 text-xs font-semibold">
                    <CheckCircle2 className="h-3 w-3 text-emerald-500" />{' '}
                    Operational
                  </p>
                </div>
              </div>
              <Badge
                variant="outline"
                className="border-emerald-500/20 bg-emerald-500/10 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400"
              >
                v21.0
              </Badge>
            </div>

            <div className="border-border/60 bg-card/80 flex items-center justify-between rounded-2xl border p-3.5 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                  <Cpu className="h-4 w-4" />
                </div>
                <div>
                  <span className="text-muted-foreground text-[11px]">
                    AI Routing Engine
                  </span>
                  <p className="text-foreground flex items-center gap-1 text-xs font-semibold">
                    <CheckCircle2 className="h-3 w-3 text-emerald-500" /> Ready
                  </p>
                </div>
              </div>
              <Badge
                variant="outline"
                className="border-purple-500/20 bg-purple-500/10 text-[10px] font-semibold text-purple-600 dark:text-purple-400"
              >
                Multi-Model
              </Badge>
            </div>

            <div className="border-border/60 bg-card/80 flex items-center justify-between rounded-2xl border p-3.5 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <Lock className="h-4 w-4" />
                </div>
                <div>
                  <span className="text-muted-foreground text-[11px]">
                    Secret Encryption
                  </span>
                  <p className="text-foreground flex items-center gap-1 text-xs font-semibold">
                    <CheckCircle2 className="h-3 w-3 text-emerald-500" />{' '}
                    AES-256-GCM
                  </p>
                </div>
              </div>
              <Badge
                variant="outline"
                className="border-blue-500/20 bg-blue-500/10 text-[10px] font-semibold text-blue-600 dark:text-blue-400"
              >
                Secured
              </Badge>
            </div>
          </div>

          {/* Breakdown & Analytics Grid */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Subscriber Plan Distribution Card */}
            <Card className="border-border/60 bg-card/80 rounded-[1.35rem] border shadow-[0_18px_50px_-30px_rgba(15,23,42,0.45)]">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-foreground flex items-center gap-2 text-sm font-semibold">
                    <Activity className="text-primary h-4 w-4" />
                    Subscriber Plan Distribution
                  </CardTitle>
                  <Link href="/admin/plans">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-foreground h-7 gap-1 rounded-lg text-xs font-medium"
                    >
                      Manage Plans <ArrowRight className="h-3 w-3" />
                    </Button>
                  </Link>
                </div>
                <CardDescription className="text-muted-foreground text-xs">
                  Breakdown of active subscriber tiers and trial accounts
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                <div className="border-border/50 flex items-center justify-between border-b py-2.5 text-xs">
                  <span className="text-muted-foreground">
                    Growth Premium (₹2,900/mo)
                  </span>
                  <Badge
                    variant="outline"
                    className="border-emerald-500/30 bg-emerald-500/10 font-semibold text-emerald-600 dark:text-emerald-400"
                  >
                    {metrics?.subscriptions?.planBreakdown?.['Growth'] || 0}{' '}
                    active
                  </Badge>
                </div>
                <div className="border-border/50 flex items-center justify-between border-b py-2.5 text-xs">
                  <span className="text-muted-foreground">
                    Enterprise Custom Tiers
                  </span>
                  <Badge
                    variant="outline"
                    className="border-blue-500/30 bg-blue-500/10 font-semibold text-blue-600 dark:text-blue-400"
                  >
                    {metrics?.subscriptions?.planBreakdown?.['Enterprise'] || 0}{' '}
                    active
                  </Badge>
                </div>
                <div className="border-border/50 flex items-center justify-between border-b py-2.5 text-xs">
                  <span className="text-muted-foreground">
                    14-Day Free Trials
                  </span>
                  <Badge
                    variant="outline"
                    className="border-amber-500/30 bg-amber-500/10 font-semibold text-amber-600 dark:text-amber-400"
                  >
                    {metrics?.subscriptions?.planBreakdown?.['Free Trial'] || 0}{' '}
                    trial
                  </Badge>
                </div>
                <div className="border-border flex items-center justify-between border-t pt-3 text-xs font-semibold">
                  <span className="text-foreground">
                    Total Registered Businesses
                  </span>
                  <span className="text-primary font-bold">
                    {metrics?.subscriptions?.total ?? 0}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Platform Active Usage Card */}
            <Card className="border-border/60 bg-card/80 rounded-[1.35rem] border shadow-[0_18px_50px_-30px_rgba(15,23,42,0.45)]">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-foreground flex items-center gap-2 text-sm font-semibold">
                    <TrendingUp className="text-primary h-4 w-4" />
                    Platform Active Usage
                  </CardTitle>
                  <Link href="/admin/ai">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-foreground h-7 gap-1 rounded-lg text-xs font-medium"
                    >
                      AI Setup <ArrowRight className="h-3 w-3" />
                    </Button>
                  </Link>
                </div>
                <CardDescription className="text-muted-foreground text-xs">
                  Monthly totals for platform API operations
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                <div className="border-border/50 flex items-center justify-between border-b py-2.5 text-xs">
                  <span className="text-muted-foreground">AI Requests Sum</span>
                  <span className="text-foreground font-semibold">
                    {(metrics?.usage?.aiRequests ?? 0).toLocaleString()} calls
                  </span>
                </div>
                <div className="border-border/50 flex items-center justify-between border-b py-2.5 text-xs">
                  <span className="text-muted-foreground">
                    WhatsApp Messages Dispatched
                  </span>
                  <span className="text-foreground font-semibold">
                    {(metrics?.usage?.whatsappMessages ?? 0).toLocaleString()}{' '}
                    msgs
                  </span>
                </div>
                <div className="border-border flex items-center justify-between border-t pt-3 text-xs font-semibold">
                  <span className="text-foreground">Billing Month</span>
                  <span className="text-muted-foreground text-xs font-normal">
                    {metrics?.usage?.month || 'Current Month'}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Navigation Cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Link href="/admin/subscribers" className="group">
              <div className="border-border/60 bg-card/80 hover:border-primary/30 flex items-center justify-between rounded-2xl border p-4 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 text-primary flex h-9 w-9 items-center justify-center rounded-xl">
                    <Users className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-foreground text-xs font-semibold">
                      Subscribers Directory
                    </span>
                    <p className="text-muted-foreground text-[11px]">
                      Inspect and manage subscriber accounts
                    </p>
                  </div>
                </div>
                <ArrowRight className="text-muted-foreground group-hover:text-primary h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
              </div>
            </Link>

            <Link href="/admin/plans" className="group">
              <div className="border-border/60 bg-card/80 hover:border-primary/30 flex items-center justify-between rounded-2xl border p-4 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                    <CreditCard className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-foreground text-xs font-semibold">
                      Plans & Pricing
                    </span>
                    <p className="text-muted-foreground text-[11px]">
                      Set tiers, limits, and feature access
                    </p>
                  </div>
                </div>
                <ArrowRight className="text-muted-foreground group-hover:text-primary h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
              </div>
            </Link>

            <Link href="/admin/ai" className="group">
              <div className="border-border/60 bg-card/80 hover:border-primary/30 flex items-center justify-between rounded-2xl border p-4 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                    <Brain className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-foreground text-xs font-semibold">
                      AI Infrastructure
                    </span>
                    <p className="text-muted-foreground text-[11px]">
                      Configure providers, models, and fallback
                    </p>
                  </div>
                </div>
                <ArrowRight className="text-muted-foreground group-hover:text-primary h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
              </div>
            </Link>
          </div>
        </div>
      )}
    </AdminNav>
  );
}
