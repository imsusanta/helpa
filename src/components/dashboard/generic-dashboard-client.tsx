'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  Inbox,
  Megaphone,
  Receipt,
  Send,
  Users,
  Wallet,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useWorkspace } from '@/hooks/use-workspace';

const metricCards = [
  {
    key: 'leads',
    label: 'TOTAL LEADS',
    filter: 'Leads Kanban',
    href: '/leads',
    tone: 'blue',
    icon: Users,
    keys: [
      'leads_total',
      'total_leads',
      'contacts_total',
      'active_patients',
      'active_members',
    ],
  },
  {
    key: 'customers',
    label: 'TOTAL CUSTOMERS',
    filter: 'CRM Accounts',
    href: '/customers',
    tone: 'indigo',
    icon: Users,
    keys: [
      'customers_total',
      'total_customers',
      'active_patients',
      'active_members',
    ],
  },
  {
    key: 'quotations',
    label: 'QUOTATIONS',
    filter: 'Estimates',
    href: '/quotations',
    tone: 'teal',
    icon: FileText,
    keys: ['quotations_total', 'quotations', 'pending_enquiries'],
  },
  {
    key: 'invoices',
    label: 'INVOICES',
    filter: 'Billing',
    href: '/invoices',
    tone: 'green',
    icon: Receipt,
    keys: ['invoices_total', 'invoices'],
  },
  {
    key: 'campaigns',
    label: 'CAMPAIGNS',
    filter: 'Broadcasts',
    href: '/campaigns',
    tone: 'purple',
    icon: Megaphone,
    keys: ['campaigns_total'],
  },
  {
    key: 'sent',
    label: 'MESSAGES SENT',
    filter: 'Outbound',
    href: '/inbox',
    tone: 'emerald',
    icon: Send,
    keys: ['messages_sent', 'sent_messages'],
  },
  {
    key: 'received',
    label: 'MESSAGES RECEIVED',
    filter: 'Inbound',
    href: '/inbox',
    tone: 'sky',
    icon: Inbox,
    keys: [
      'messages_received',
      'received_messages',
      'unread_chats',
      'conversations_active',
    ],
  },
  {
    key: 'wallet',
    label: 'COLLECTED REVENUE',
    filter: 'Collections',
    href: '/invoices',
    tone: 'orange',
    icon: Wallet,
    keys: ['collected_revenue', 'wallet_balance', 'balance'],
  },
] as const;

const iconBgClasses: Record<string, string> = {
  blue: 'bg-[#2563eb] text-white',
  indigo: 'bg-[#6366f1] text-white',
  teal: 'bg-[#06b6d4] text-white',
  green: 'bg-[#10b981] text-white',
  purple: 'bg-[#a855f7] text-white',
  emerald: 'bg-[#10b981] text-white',
  sky: 'bg-[#0284c7] text-white',
  orange: 'bg-[#f97316] text-white',
};

function getMetric(metrics: Record<string, number>, keys: readonly string[]) {
  for (const key of keys)
    if (typeof metrics[key] === 'number') return metrics[key];
  return 0;
}

function formatValue(value: number, currency = false) {
  return currency
    ? `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : value.toLocaleString('en-IN');
}

function FilterPill({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <span className="inline-flex h-7 items-center rounded-xl border border-slate-200 bg-slate-50 px-2.5 text-[11px] font-semibold text-slate-600">
      {children}
    </span>
  );
}

export function GenericDashboardClient() {
  const { terminology } = useWorkspace();
  const { account, accountId, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<Record<string, number>>({});
  const [range, setRange] = useState('30d');
  const userName =
    profile?.full_name?.split(' ')[0] || account?.name || 'susanta';

  useEffect(() => {
    if (!accountId) return;
    let cancelled = false;
    fetch('/api/dashboard/metrics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ industry: account?.industry, range }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!cancelled && res.ok && data.success)
          setMetrics(data.metrics || {});
      })
      .catch((error) => console.error('Metrics fetch error:', error))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accountId, account?.industry, range]);

  const totalPipeline = useMemo(
    () =>
      getMetric(metrics, [
        'leads_total',
        'total_leads',
        'contacts_total',
        'active_patients',
        'active_members',
      ]),
    [metrics]
  );

  const contextualMetricCards = useMemo(
    () =>
      metricCards.map((card) => {
        if (card.key === 'leads')
          return {
            ...card,
            label: `TOTAL ${terminology.pipelineItems.toUpperCase()}`,
            filter: `${terminology.pipelineItems} Board`,
          };
        if (card.key === 'customers')
          return {
            ...card,
            label: `TOTAL ${terminology.people.toUpperCase()}`,
            filter: terminology.primaryRecords,
          };
        if (card.key === 'campaigns')
          return { ...card, label: terminology.campaigns.toUpperCase() };
        return card;
      }),
    [terminology]
  );

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-[1536px] space-y-5">
        <div className="h-16 animate-pulse rounded-2xl bg-white" />
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className={`animate-pulse rounded-2xl bg-white ${i < 4 ? 'h-[148px]' : 'h-[180px]'}`}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1536px] space-y-5 pb-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[30px] leading-tight font-extrabold tracking-[-0.035em] text-[#0f172a]">
            Welcome back, {userName}! <span aria-hidden>👋</span>
          </h1>
          <p className="mt-1 text-[15px] font-medium text-slate-500">
            Here&apos;s what&apos;s happening with your business today.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={range}
            onChange={(e) => setRange(e.target.value)}
            className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-700 shadow-[0_2px_8px_rgba(15,23,42,0.05)] focus:outline-none"
          >
            <option value="today">Today</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="this_month">This Month</option>
            <option value="this_year">This Year</option>
            <option value="all_time">All Time</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {contextualMetricCards.map((card, index) => {
          const Icon = card.icon;
          const value = getMetric(metrics, card.keys);
          const isWallet = card.key === 'wallet';
          const isTopRow = index < 4;
          return (
            <Link
              key={card.key}
              href={card.href}
              className={`group relative flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[0_2px_8px_rgba(15,23,42,0.04)] transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg ${isTopRow ? 'h-[148px]' : 'h-[180px]'}`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-[12px] font-bold tracking-[0.055em] text-[#64748b] uppercase group-hover:text-slate-900">
                  {card.label}
                </span>
                {card.filter && (
                  <span className="inline-flex h-6 items-center rounded-lg bg-slate-50 px-2 text-[10px] font-bold text-slate-500">
                    {card.filter}
                  </span>
                )}
              </div>

              <div>
                <div className="text-[34px] leading-none font-extrabold tracking-[-0.03em] text-[#0f172a]">
                  {formatValue(value, isWallet)}
                </div>
              </div>

              <div
                className={`absolute right-5 ${isTopRow ? 'bottom-5' : 'top-5'} flex h-12 w-12 items-center justify-center rounded-xl shadow-[0_4px_10px_rgba(15,23,42,0.10)] transition-transform group-hover:scale-105 ${iconBgClasses[card.tone]}`}
              >
                <Icon className="h-5 w-5" />
              </div>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="flex h-[364px] flex-col rounded-2xl border border-slate-200/90 bg-white shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-[15px] font-bold text-[#0f172a]">
              {terminology.pipeline} Overview
            </h2>
          </div>
          <div className="flex flex-1 flex-col justify-between p-5">
            <div className="space-y-6 pt-1">
              {[
                {
                  label: `New ${terminology.pipelineItems}`,
                  val: totalPipeline,
                },
                { label: 'Contacted / Assigned', val: 0 },
                { label: 'Qualified / Won', val: 0 },
              ].map((row) => (
                <div key={row.label} className="flex items-center gap-3">
                  <span className="w-[96px] shrink-0 text-[12px] leading-4 font-medium text-slate-600">
                    {row.label}
                  </span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-slate-200"
                      style={{
                        width: `${Math.min(100, Math.max(0, Number(row.val) * 10))}%`,
                      }}
                    />
                  </div>
                  <span className="w-6 text-right text-[12px] font-extrabold text-[#0f172a]">
                    {row.val}
                  </span>
                </div>
              ))}
            </div>
            <div className="border-t border-slate-100 pt-3 text-right text-[12px] font-semibold text-slate-500">
              Total {terminology.pipelineItems}:{' '}
              <span className="font-extrabold text-[#0f172a]">
                {totalPipeline || 1}
              </span>
            </div>
          </div>
        </div>

        <div className="flex h-[364px] flex-col rounded-2xl border border-slate-200/90 bg-white shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="text-[15px] font-bold text-[#0f172a]">
              Top {terminology.pipelineItem} Sources
            </h2>
            <FilterPill>This Month</FilterPill>
          </div>
          <div className="flex flex-1 flex-col justify-between p-5">
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <span className="text-[11px] font-bold tracking-widest text-slate-400 uppercase">
                TOTAL
              </span>
              <span className="mt-1 text-[34px] leading-none font-extrabold text-[#0f172a]">
                {totalPipeline}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-y-3 px-1 text-xs font-medium text-slate-600">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#3b82f6]" />
                <span>WhatsApp</span>
                <strong className="ml-auto font-bold text-[#0f172a]">0%</strong>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#22c55e]" />
                <span>Facebook</span>
                <strong className="ml-auto font-bold text-[#0f172a]">0%</strong>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#f97316]" />
                <span>Import</span>
                <strong className="ml-auto font-bold text-[#0f172a]">0%</strong>
              </div>
            </div>
          </div>
        </div>

        <div className="flex h-[364px] flex-col rounded-2xl border border-slate-200/90 bg-white shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="text-[15px] font-bold text-[#0f172a]">
              Upcoming Follow-ups
            </h2>
            <div className="flex items-center gap-2">
              <FilterPill>
                <Clock className="mr-0.5 h-3 w-3 text-slate-500" />
                All Days
              </FilterPill>
              <Link
                href="/follow-ups"
                className="text-xs font-bold text-blue-600 hover:text-blue-700"
              >
                View All
              </Link>
            </div>
          </div>
          <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
            <div className="relative mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 shadow-[0_2px_5px_rgba(15,23,42,0.04)]">
              <Calendar className="h-8 w-8 text-slate-400" />
              <div className="absolute -right-1.5 -bottom-1.5 rounded-full bg-white p-0.5 shadow-sm">
                <CheckCircle2 className="h-5 w-5 fill-[#10b981] text-white" />
              </div>
            </div>
            <p className="max-w-[245px] text-[13px] leading-relaxed font-medium text-slate-500">
              No upcoming call or meeting follow-ups for this period
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
