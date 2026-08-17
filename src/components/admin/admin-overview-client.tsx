'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Users,
  Layers,
  Activity,
  TrendingUp,
  Brain,
  CreditCard,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AdminNav } from './admin-nav';

interface Metrics {
  totalAccounts: number;
  totalContacts: number;
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

const DEFAULT_METRICS: Metrics = {
  totalAccounts: 1,
  totalContacts: 0,
  totalUsers: 1,
  subscriptions: {
    active: 1,
    trial: 0,
    expired: 0,
    total: 1,
    planBreakdown: { Standard: 1 },
  },
  usage: {
    month: new Date().toISOString().substring(0, 7) + '-01',
    aiRequests: 0,
    whatsappMessages: 0,
  },
};

export function AdminOverviewClient() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<Metrics>(DEFAULT_METRICS);

  async function loadData() {
    setLoading(true);
    try {
      const mRes = await fetch('/api/admin/metrics');
      if (mRes.ok) {
        const mData = await mRes.json();
        setMetrics(mData);
      }
    } catch (err) {
      console.error('Failed to load metrics:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-6">
      <AdminNav onRefresh={loadData} loading={loading} />

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
            <p className="text-muted-foreground text-xs font-medium">
              Loading platform diagnostics...
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* KPI Metrics Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Active Tenants Card */}
            <Card className="bg-card border-border shadow-none">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-xs font-medium">
                    Active Tenants
                  </span>
                  <div className="bg-muted flex h-8 w-8 items-center justify-center rounded-lg">
                    <Layers className="text-muted-foreground h-4 w-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <span className="text-foreground text-2xl font-semibold tracking-tight tabular-nums">
                    {metrics?.totalAccounts ?? 0}
                  </span>
                </div>
                <p className="text-muted-foreground mt-1 text-xs">
                  Registered business workspaces
                </p>
              </CardContent>
            </Card>

            {/* Platform Users Card */}
            <Card className="bg-card border-border shadow-none">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-xs font-medium">
                    Platform Agents
                  </span>
                  <div className="bg-muted flex h-8 w-8 items-center justify-center rounded-lg">
                    <Users className="text-muted-foreground h-4 w-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <span className="text-foreground text-2xl font-semibold tracking-tight tabular-nums">
                    {metrics?.totalUsers ?? 0}
                  </span>
                </div>
                <p className="text-muted-foreground mt-1 text-xs">
                  Configured agents and owners
                </p>
              </CardContent>
            </Card>

            {/* Monthly AI Requests Card */}
            <Card className="bg-card border-border shadow-none">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-xs font-medium">
                    AI Requests (Month)
                  </span>
                  <div className="bg-muted flex h-8 w-8 items-center justify-center rounded-lg">
                    <Activity className="text-muted-foreground h-4 w-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <span className="text-foreground text-2xl font-semibold tracking-tight tabular-nums">
                    {(metrics?.usage?.aiRequests ?? 0).toLocaleString()}
                  </span>
                </div>
                <p className="text-muted-foreground mt-1 text-xs">
                  Total autopilot completions
                </p>
              </CardContent>
            </Card>

            {/* Total Contacts Card */}
            <Card className="bg-card border-border shadow-none">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-xs font-medium">
                    Total Contacts
                  </span>
                  <div className="bg-muted flex h-8 w-8 items-center justify-center rounded-lg">
                    <Users className="text-muted-foreground h-4 w-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <span className="text-foreground text-2xl font-semibold tracking-tight tabular-nums">
                    {(metrics?.totalContacts ?? 0).toLocaleString()}
                  </span>
                </div>
                <p className="text-muted-foreground mt-1 text-xs">
                  CRM contacts across tenants
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Subscriptions Tier Card */}
            <Card className="bg-card border-border shadow-none">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-foreground flex items-center gap-2 text-sm font-semibold">
                    <Layers className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    Subscriptions Tier Share
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
                  Breakdown of tenant plan registrations
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                <div className="flex items-center justify-between py-1.5 text-xs">
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
                <div className="flex items-center justify-between py-1.5 text-xs">
                  <span className="text-muted-foreground">
                    Enterprise custom plans
                  </span>
                  <Badge
                    variant="outline"
                    className="border-blue-500/30 bg-blue-500/10 font-medium text-blue-600 dark:text-blue-400"
                  >
                    {metrics?.subscriptions?.planBreakdown?.['Enterprise'] || 0}{' '}
                    active
                  </Badge>
                </div>
                <div className="flex items-center justify-between py-1.5 text-xs">
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
                    Total Active Contracts
                  </span>
                  <span className="text-emerald-600 dark:text-emerald-400">
                    {metrics?.subscriptions?.total ?? 0}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Platform Active Usage Card */}
            <Card className="bg-card border-border shadow-none">
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
                  Monthly totals for API transactions
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                <div className="flex items-center justify-between py-1.5 text-xs">
                  <span className="text-muted-foreground">AI Requests Sum</span>
                  <span className="text-foreground font-medium">
                    {(metrics?.usage?.aiRequests ?? 0).toLocaleString()} calls
                  </span>
                </div>
                <div className="flex items-center justify-between py-1.5 text-xs">
                  <span className="text-muted-foreground">
                    WhatsApp Messages Sent
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
            <Link href="/admin/tenants" className="group">
              <Card className="bg-card border-border hover:bg-muted/30 shadow-none transition-colors">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-muted flex h-9 w-9 items-center justify-center rounded-lg">
                      <Users className="text-foreground h-4 w-4" />
                    </div>
                    <div>
                      <span className="text-foreground text-xs font-semibold">
                        Tenants Directory
                      </span>
                      <p className="text-muted-foreground text-[11px]">
                        Inspect and manage workspace accounts
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="text-muted-foreground group-hover:text-foreground h-4 w-4 transition-colors" />
                </CardContent>
              </Card>
            </Link>

            <Link href="/admin/plans" className="group">
              <Card className="bg-card border-border hover:bg-muted/30 shadow-none transition-colors">
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
                        Set tiers, pricing, and feature flags
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="text-muted-foreground group-hover:text-foreground h-4 w-4 transition-colors" />
                </CardContent>
              </Card>
            </Link>

            <Link href="/admin/ai" className="group">
              <Card className="bg-card border-border hover:bg-muted/30 shadow-none transition-colors">
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
