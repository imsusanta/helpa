'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  Building2,
  CreditCard,
  Loader2,
  MessageCircle,
  Plus,
  TrendingUp,
  Users,
} from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { AdminNav } from './admin-nav';

interface Metrics {
  totalAccounts: number;
  totalUsers: number;
  subscriptions: {
    active: number;
    trial: number;
    expired: number;
    total: number;
    planBreakdown: Record<string, number>;
  };
  usage: { month: string; aiRequests: number; whatsappMessages: number };
}
interface Revenue {
  monthlyRecurringRevenue: number;
  pastDueCount: number;
  activeSubscriptionsCount: number;
  trialCustomersCount: number;
  revenueByPlan: Record<string, number>;
}
const EMPTY: Metrics = {
  totalAccounts: 0,
  totalUsers: 0,
  subscriptions: {
    active: 0,
    trial: 0,
    expired: 0,
    total: 0,
    planBreakdown: {},
  },
  usage: { month: '', aiRequests: 0, whatsappMessages: 0 },
};
const money = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value || 0);

export function AdminOverviewClient() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<Metrics>(EMPTY);
  const [revenue, setRevenue] = useState<Revenue | null>(null);
  const [error, setError] = useState(false);
  async function loadData() {
    setLoading(true);
    setError(false);
    try {
      const [m, r] = await Promise.all([
        fetch('/api/admin/metrics'),
        fetch('/api/admin/revenue'),
      ]);
      if (!m.ok) throw new Error();
      setMetrics(await m.json());
      if (r.ok) setRevenue(await r.json());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    loadData();
  }, []);
  const active = metrics.subscriptions?.active ?? 0;
  const aiUsed = metrics.usage?.aiRequests ?? 0;
  const aiLimit = 10000;
  const aiPercent = Math.min(100, Math.round((aiUsed / aiLimit) * 100));
  const whatsappConnected = metrics.usage?.whatsappMessages ? active : 0;
  const attention = [
    {
      show: metrics.totalAccounts - whatsappConnected > 0,
      text: `${metrics.totalAccounts - whatsappConnected} businesses may need WhatsApp attention`,
      href: '/admin/subscribers',
    },
    {
      show: Boolean(revenue?.pastDueCount),
      text: `${revenue?.pastDueCount ?? 0} payments need attention`,
      href: '/admin/plans',
    },
    {
      show: aiPercent >= 80,
      text: 'AI usage is close to the monthly allowance',
      href: '/admin/ai',
    },
  ].filter((x) => x.show);
  const cards = [
    { label: 'Businesses', value: metrics.totalAccounts, icon: Building2 },
    { label: 'Active businesses', value: active, icon: Users },
    {
      label: 'Monthly revenue',
      value: money(revenue?.monthlyRecurringRevenue ?? 0),
      icon: CreditCard,
    },
    { label: 'AI usage', value: `${aiPercent}%`, icon: Bot },
    {
      label: 'WhatsApp connected',
      value: whatsappConnected,
      icon: MessageCircle,
    },
  ];
  return (
    <div className="lg:pl-64">
      <AdminNav onRefresh={loadData} loading={loading} />
      <main className="mx-auto max-w-7xl space-y-8 px-1 pb-12 lg:px-8 lg:pt-24">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-950 sm:text-3xl dark:text-white">
            Good morning, Susanta 👋
          </h1>
          <p className="mt-2 text-sm text-neutral-500 sm:text-base">
            Here&apos;s what&apos;s happening with Helpa today.
          </p>
        </header>
        {loading ? (
          <div className="flex min-h-72 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
            <span className="sr-only">Loading business overview</span>
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-5 dark:border-red-900 dark:bg-red-950/30">
            <p className="font-medium text-red-900 dark:text-red-200">
              We couldn&apos;t load your business overview.
            </p>
            <p className="mt-1 text-sm text-red-700 dark:text-red-300">
              Please try again. Your settings have not been changed.
            </p>
            <Button className="mt-4" variant="outline" onClick={loadData}>
              Try again
            </Button>
          </div>
        ) : (
          <>
            <section
              aria-label="Business summary"
              className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"
            >
              {cards.map(({ label, value, icon: Icon }) => (
                <div
                  key={label}
                  className="rounded-xl border border-neutral-200 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,.03)] dark:border-neutral-800 dark:bg-neutral-950"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-neutral-500">{label}</p>
                    <Icon className="h-4 w-4 text-neutral-400" />
                  </div>
                  <p className="mt-3 text-2xl font-semibold tracking-tight text-neutral-950 tabular-nums dark:text-white">
                    {value}
                  </p>
                </div>
              ))}
            </section>
            <section className="rounded-xl border border-amber-200 bg-amber-50/70 p-5 dark:border-amber-900/70 dark:bg-amber-950/20">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                <h2 className="font-semibold text-neutral-950 dark:text-white">
                  Needs your attention
                </h2>
              </div>
              {attention.length ? (
                <div className="mt-4 divide-y divide-amber-200/70 dark:divide-amber-900/60">
                  {attention.map((item) => (
                    <div
                      key={item.text}
                      className="flex items-center justify-between gap-4 py-3"
                    >
                      <p className="text-sm text-neutral-700 dark:text-neutral-300">
                        {item.text}
                      </p>
                      <Link
                        href={item.href}
                        className="inline-flex min-h-10 items-center gap-1 text-sm font-medium text-amber-800 hover:underline dark:text-amber-300"
                      >
                        View <ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-300">
                  Everything looks good. No action is needed right now.
                </p>
              )}
            </section>
            <section>
              <h2 className="text-base font-semibold">Quick actions</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href="/admin/subscribers"
                  className={buttonVariants({ variant: 'default' })}
                >
                  <Plus className="h-4 w-4" /> Add business
                </Link>
                <Link
                  href="/admin/plans"
                  className={buttonVariants({ variant: 'outline' })}
                >
                  <CreditCard className="h-4 w-4" /> Create plan
                </Link>
                <Link
                  href="/admin/ai"
                  className={buttonVariants({ variant: 'outline' })}
                >
                  <Bot className="h-4 w-4" /> AI settings
                </Link>
              </div>
            </section>
            <div className="grid gap-6 lg:grid-cols-3">
              <section className="rounded-xl border border-neutral-200 bg-white p-5 lg:col-span-2 dark:border-neutral-800 dark:bg-neutral-950">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold">Revenue</h2>
                    <p className="mt-1 text-sm text-neutral-500">
                      A simple view of recurring revenue
                    </p>
                  </div>
                  <TrendingUp className="h-5 w-5 text-emerald-600" />
                </div>
                <p className="mt-6 text-3xl font-semibold tracking-tight">
                  {money(revenue?.monthlyRecurringRevenue ?? 0)}
                </p>
                <div
                  className="mt-6 flex h-28 items-end gap-2"
                  aria-label="Revenue by plan"
                >
                  {Object.entries(revenue?.revenueByPlan ?? {}).map(
                    ([name, value]) => {
                      const max = Math.max(
                        ...Object.values(revenue?.revenueByPlan ?? { all: 1 }),
                        1
                      );
                      return (
                        <div
                          key={name}
                          className="flex flex-1 flex-col justify-end gap-2"
                        >
                          <div
                            className="rounded-t-md bg-emerald-500/80"
                            style={{
                              height: `${Math.max(8, (value / max) * 80)}px`,
                            }}
                          />
                          <span className="text-center text-xs text-neutral-500 capitalize">
                            {name}
                          </span>
                        </div>
                      );
                    }
                  )}
                </div>
              </section>
              <section className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
                <h2 className="font-semibold">Business health</h2>
                <div className="mt-5 space-y-5">
                  {[
                    ['Active', active, metrics.totalAccounts],
                    [
                      'Trials',
                      metrics.subscriptions.trial,
                      metrics.totalAccounts,
                    ],
                    ['AI used', aiUsed, aiLimit],
                  ].map(([label, value, total]) => (
                    <div key={String(label)}>
                      <div className="flex justify-between text-sm">
                        <span className="text-neutral-500">{label}</span>
                        <span className="font-medium tabular-nums">
                          {Number(value).toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-neutral-100 dark:bg-neutral-800">
                        <div
                          className="h-2 rounded-full bg-emerald-600"
                          style={{
                            width: `${Math.min(100, (Number(value) / Math.max(Number(total), 1)) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
