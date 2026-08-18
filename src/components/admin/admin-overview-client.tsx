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
    <div className="space-y-6">
      <AdminNav onRefresh={fetchOverviewData} loading={loading} />

      {error ? (
        <div className="border-destructive/20 bg-destructive/10 text-destructive flex items-center gap-3 rounded-xl border p-4 text-xs">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
          <Button
            size="sm"
            variant="outline"
            onClick={fetchOverviewData}
            className="ml-auto h-7 text-xs"
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
            <Card className="border-border bg-card shadow-none">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-xs font-medium">
                    Total Subscribers
                  </span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <Users className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-foreground text-2xl font-bold tracking-tight">
                    {metrics?.totalAccounts ?? 0}
                  </div>
                  <div className="text-muted-foreground mt-1 flex items-center gap-1.5 text-xs">
                    <span className="font-medium text-emerald-600 dark:text-emerald-400">
                      {metrics?.subscriptions?.active ?? 0} active
                    </span>
                    <span>•</span>
                    <span>{metrics?.subscriptions?.trial ?? 0} trials</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border bg-card shadow-none">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-xs font-medium">
                    Monthly Recurring Revenue
                  </span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                    <CreditCard className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-foreground text-2xl font-bold tracking-tight">
                    {formatCurrency(revenue?.monthlyRecurringRevenue ?? 0)}
                  </div>
                  <div className="text-muted-foreground mt-1 flex items-center gap-1.5 text-xs">
                    <span className="font-medium text-blue-600 dark:text-blue-400">
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
                </div>
              </CardContent>
            </Card>

            <Card className="border-border bg-card shadow-none">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-xs font-medium">
                    Monthly AI Calls
                  </span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
                    <Brain className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-foreground text-2xl font-bold tracking-tight">
                    {(metrics?.usage?.aiRequests ?? 0).toLocaleString()}
                  </div>
                  <div className="text-muted-foreground mt-1 flex items-center gap-1 text-xs">
                    <span className="text-purple-600 dark:text-purple-400">
                      {metrics?.usage?.month || 'Current Month'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border bg-card shadow-none">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-xs font-medium">
                    WhatsApp Messages
                  </span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <MessageSquare className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-foreground text-2xl font-bold tracking-tight">
                    {(metrics?.usage?.whatsappMessages ?? 0).toLocaleString()}
                  </div>
                  <div className="text-muted-foreground mt-1 flex items-center gap-1 text-xs">
                    <span className="text-emerald-600 dark:text-emerald-400">
                      Outbound + Inbound
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Platform Status & Infrastructure Diagnostics */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-border bg-card shadow-none">
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="bg-muted flex h-8 w-8 items-center justify-center rounded-lg">
                    <Database className="text-muted-foreground h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">
                      Database Platform
                    </span>
                    <p className="text-foreground mt-0.5 flex items-center gap-1 text-xs font-semibold">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />{' '}
                      Connected
                    </p>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className="border-emerald-500/30 text-[10px] text-emerald-600 dark:text-emerald-400"
                >
                  Active
                </Badge>
              </CardContent>
            </Card>

            <Card className="border-border bg-card shadow-none">
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="bg-muted flex h-8 w-8 items-center justify-center rounded-lg">
                    <Zap className="text-muted-foreground h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">
                      WhatsApp Cloud API
                    </span>
                    <p className="text-foreground mt-0.5 flex items-center gap-1 text-xs font-semibold">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />{' '}
                      Operational
                    </p>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className="border-emerald-500/30 text-[10px] text-emerald-600 dark:text-emerald-400"
                >
                  v21.0
                </Badge>
              </CardContent>
            </Card>

            <Card className="border-border bg-card shadow-none">
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="bg-muted flex h-8 w-8 items-center justify-center rounded-lg">
                    <Cpu className="text-muted-foreground h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">
                      AI Router
                    </span>
                    <p className="text-foreground mt-0.5 flex items-center gap-1 text-xs font-semibold">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />{' '}
                      Ready
                    </p>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className="border-emerald-500/30 text-[10px] text-emerald-600 dark:text-emerald-400"
                >
                  Multi-Model
                </Badge>
              </CardContent>
            </Card>

            <Card className="border-border bg-card shadow-none">
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="bg-muted flex h-8 w-8 items-center justify-center rounded-lg">
                    <Lock className="text-muted-foreground h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">
                      Secret Encryption
                    </span>
                    <p className="text-foreground mt-0.5 flex items-center gap-1 text-xs font-semibold">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />{' '}
                      AES-256-GCM
                    </p>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className="border-blue-500/30 text-[10px] text-blue-600 dark:text-blue-400"
                >
                  Secured
                </Badge>
              </CardContent>
            </Card>
          </div>

          {/* Breakdown & Analytics Grid */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Subscriber Plan Distribution Card */}
            <Card className="border-border bg-card shadow-none">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-foreground flex items-center gap-2 text-sm font-semibold">
                    <Activity className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    Subscriber Plan Distribution
                  </CardTitle>
                  <Link href="/admin/plans">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-foreground h-7 gap-1 text-xs font-medium"
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
                <div className="border-border/50 flex items-center justify-between border-b py-2 text-xs">
                  <span className="text-muted-foreground">
                    Growth Premium (₹2,900/mo)
                  </span>
                  <Badge
                    variant="outline"
                    className="border-emerald-500/30 bg-emerald-500/10 font-medium text-emerald-600 dark:text-emerald-400"
                  >
                    {metrics?.subscriptions?.planBreakdown?.['Growth'] || 0}{' '}
                    active
                  </Badge>
                </div>
                <div className="border-border/50 flex items-center justify-between border-b py-2 text-xs">
                  <span className="text-muted-foreground">
                    Enterprise Custom Tiers
                  </span>
                  <Badge
                    variant="outline"
                    className="border-blue-500/30 bg-blue-500/10 font-medium text-blue-600 dark:text-blue-400"
                  >
                    {metrics?.subscriptions?.planBreakdown?.['Enterprise'] || 0}{' '}
                    active
                  </Badge>
                </div>
                <div className="border-border/50 flex items-center justify-between border-b py-2 text-xs">
                  <span className="text-muted-foreground">
                    14-Day Free Trials
                  </span>
                  <Badge
                    variant="outline"
                    className="border-amber-500/30 bg-amber-500/10 font-medium text-amber-600 dark:text-amber-400"
                  >
                    {metrics?.subscriptions?.planBreakdown?.['Free Trial'] || 0}{' '}
                    trial
                  </Badge>
                </div>
                <div className="border-border flex items-center justify-between border-t pt-3 text-xs font-semibold">
                  <span className="text-foreground">
                    Total Registered Businesses
                  </span>
                  <span className="text-emerald-600 dark:text-emerald-400">
                    {metrics?.subscriptions?.total ?? 0}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Platform Active Usage Card */}
            <Card className="border-border bg-card shadow-none">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-foreground flex items-center gap-2 text-sm font-semibold">
                    <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    Platform Active Usage
                  </CardTitle>
                  <Link href="/admin/ai">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-foreground h-7 gap-1 text-xs font-medium"
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
                <div className="border-border/50 flex items-center justify-between border-b py-2 text-xs">
                  <span className="text-muted-foreground">AI Requests Sum</span>
                  <span className="text-foreground font-medium">
                    {(metrics?.usage?.aiRequests ?? 0).toLocaleString()} calls
                  </span>
                </div>
                <div className="border-border/50 flex items-center justify-between border-b py-2 text-xs">
                  <span className="text-muted-foreground">
                    WhatsApp Messages Dispatched
                  </span>
                  <span className="text-foreground font-medium">
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
              <Card className="border-border bg-card hover:bg-muted/30 shadow-none transition-colors">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-muted flex h-9 w-9 items-center justify-center rounded-lg">
                      <Users className="text-foreground h-4 w-4" />
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
                  <ArrowRight className="text-muted-foreground group-hover:text-foreground h-4 w-4 transition-colors" />
                </CardContent>
              </Card>
            </Link>

            <Link href="/admin/plans" className="group">
              <Card className="border-border bg-card hover:bg-muted/30 shadow-none transition-colors">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-muted flex h-9 w-9 items-center justify-center rounded-lg">
                      <CreditCard className="text-foreground h-4 w-4" />
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
                  <ArrowRight className="text-muted-foreground group-hover:text-foreground h-4 w-4 transition-colors" />
                </CardContent>
              </Card>
            </Link>

            <Link href="/admin/ai" className="group">
              <Card className="border-border bg-card hover:bg-muted/30 shadow-none transition-colors">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-muted flex h-9 w-9 items-center justify-center rounded-lg">
                      <Brain className="text-foreground h-4 w-4" />
                    </div>
                    <div>
                      <span className="text-foreground text-xs font-semibold">
                        AI Setup
                      </span>
                      <p className="text-muted-foreground text-[11px]">
                        Configure providers, models, and fallback
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="text-muted-foreground group-hover:text-foreground h-4 w-4 transition-colors" />
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
