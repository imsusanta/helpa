'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  Calendar,
  CheckCircle2,
  ChevronDown,
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

const metricCards = [
  {
    key: 'leads',
    label: 'TOTAL LEADS',
    filter: 'All Time',
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
    filter: 'All Time',
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
    filter: 'This Month',
    tone: 'teal',
    icon: FileText,
    keys: ['quotations_total', 'quotations', 'pending_enquiries'],
  },
  {
    key: 'invoices',
    label: 'INVOICES',
    filter: 'This Month',
    tone: 'green',
    icon: Receipt,
    keys: ['invoices_total', 'invoices'],
  },
  {
    key: 'campaigns',
    label: 'CAMPAIGNS',
    filter: '',
    tone: 'purple',
    icon: Megaphone,
    keys: ['campaigns_total'],
  },
  {
    key: 'sent',
    label: 'MESSAGES SENT',
    filter: '',
    tone: 'emerald',
    icon: Send,
    keys: ['messages_sent', 'sent_messages'],
  },
  {
    key: 'received',
    label: 'MESSAGES RECEIVED',
    filter: '',
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
    label: 'WALLET BALANCE',
    filter: '',
    tone: 'orange',
    icon: Wallet,
    keys: ['wallet_balance', 'balance'],
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
    <button
      type="button"
      className="inline-flex h-7 shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-600 shadow-2xs transition-colors hover:bg-slate-50"
    >
      {children}
      <ChevronDown className="h-3 w-3 text-slate-400" />
    </button>
  );
}

export function GenericDashboardClient() {
  const { account, accountId, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<Record<string, number>>({});
  const userName =
    profile?.full_name?.split(' ')[0] || account?.name || 'susanta';

  useEffect(() => {
    if (!accountId) return;
    let cancelled = false;
    fetch('/api/dashboard/metrics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ industry: account?.industry }),
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
  }, [accountId, account?.industry]);

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

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-[1536px] space-y-5">
        <div className="h-16 animate-pulse rounded-2xl bg-white" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
    <div className="mx-auto w-full max-w-[1536px] space-y-5 pb-4">
      {/* 1. Main Welcome Header & Date Selector */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-tight text-[#0f172a] lg:text-[30px]">
            Welcome back, {userName}! <span aria-hidden>👋</span>
          </h1>
          <p className="mt-1 text-[14px] font-medium text-slate-500 lg:text-[15px]">
            Here&apos;s what&apos;s happening with your business today.
          </p>
        </div>

        {/* Date Selector */}
        <div className="inline-flex h-11 items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-[#0f172a] shadow-2xs">
          <Calendar className="h-4 w-4 text-slate-500" />
          <span>Aug 16, 2026 – Aug 22, 2026</span>
        </div>
      </div>

      {/* 2. Exactly 8 KPI Cards (4 columns desktop) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metricCards.map((card, index) => {
          const Icon = card.icon;
          const value = getMetric(metrics, card.keys);
          const isWallet = card.key === 'wallet';
          const hasFilter = Boolean(card.filter);
          const isTopRow = index < 4;

          return (
            <div
              key={card.key}
              className={`relative flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs ${
                isTopRow ? 'h-[148px]' : 'h-[180px]'
              }`}
            >
              {/* Card Header */}
              <div className="flex items-start justify-between gap-2">
                <span className="text-[12px] font-bold tracking-[0.06em] text-[#64748b] uppercase">
                  {card.label}
                </span>
                {hasFilter && <FilterPill>{card.filter}</FilterPill>}
              </div>

              {/* Card Body / Value */}
              <div>
                <div className="text-[34px] leading-none font-extrabold tracking-tight text-[#0f172a]">
                  {formatValue(value, isWallet)}
                </div>

                {isWallet && (
                  <div className="mt-3.5 flex items-center gap-2">
                    <span className="rounded-md bg-[#eff6ff] px-2.5 py-0.5 text-[11px] font-bold text-[#2563eb]">
                      Normal: ₹0.00
                    </span>
                    <span className="rounded-md bg-[#faf5ff] px-2.5 py-0.5 text-[11px] font-bold text-[#9333ea]">
                      Offer: ₹0.00
                    </span>
                  </div>
                )}
              </div>

              {/* Floating Icon Box */}
              <div
                className={`absolute right-5 ${
                  isTopRow ? 'bottom-5' : 'top-5'
                } flex h-11 w-11 items-center justify-center rounded-xl shadow-2xs ${
                  iconBgClasses[card.tone]
                }`}
              >
                <Icon className="h-5 w-5" />
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. Lower Dashboard Panels (3 Columns) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* PANEL 1: Sales Pipeline Overview */}
        <div className="flex h-[360px] flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
          <div>
            <h2 className="text-[15px] font-bold text-[#0f172a]">
              Sales Pipeline Overview
            </h2>

            <div className="mt-6 space-y-6">
              {[
                { label: 'New Leads', val: totalPipeline },
                { label: 'Contacted / Assigned', val: 0 },
                { label: 'Qualified / Won', val: 0 },
              ].map((row) => (
                <div key={row.label} className="flex items-center gap-3">
                  <span className="w-40 text-xs font-semibold text-slate-600">
                    {row.label}
                  </span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-slate-300 transition-all"
                      style={{
                        width: `${Math.min(100, Math.max(0, Number(row.val) * 10))}%`,
                      }}
                    />
                  </div>
                  <span className="w-6 text-right text-xs font-extrabold text-[#0f172a]">
                    {row.val}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="text-right text-xs font-bold text-slate-500">
            Total Pipeline Leads:{' '}
            <span className="font-extrabold text-[#0f172a]">
              {totalPipeline || 1}
            </span>
          </div>
        </div>

        {/* PANEL 2: Top Lead Sources */}
        <div className="flex h-[360px] flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-bold text-[#0f172a]">
              Top Lead Sources
            </h2>
            <FilterPill>This Month</FilterPill>
          </div>

          {/* Center Total Value */}
          <div className="flex flex-col items-center justify-center text-center">
            <span className="text-[11px] font-bold tracking-widest text-slate-400 uppercase">
              TOTAL
            </span>
            <span className="text-[34px] font-extrabold text-[#0f172a]">
              {totalPipeline}
            </span>
          </div>

          {/* Bottom Legend */}
          <div className="flex items-center justify-between px-2 text-xs font-medium text-slate-600">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#2563eb]" />
              <span>WhatsApp</span>
              <strong className="font-bold text-[#0f172a]">0%</strong>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#10b981]" />
              <span>Facebook</span>
              <strong className="font-bold text-[#0f172a]">0%</strong>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#f97316]" />
              <span>Import</span>
              <strong className="font-bold text-[#0f172a]">0%</strong>
            </div>
          </div>
        </div>

        {/* PANEL 3: Upcoming Follow-ups */}
        <div className="flex h-[360px] flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
          {/* Header */}
          <div className="flex items-center justify-between">
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

          {/* Center Empty State Illustration */}
          <div className="flex flex-col items-center justify-center px-4 text-center">
            {/* Illustrated Calendar Icon with Green Checkmark Badge */}
            <div className="relative mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-200/80 bg-slate-100/80 shadow-2xs">
              <Calendar className="h-8 w-8 text-slate-400" />
              <div className="absolute -right-1.5 -bottom-1.5 rounded-full bg-white p-0.5 shadow-xs">
                <CheckCircle2 className="h-5 w-5 fill-[#10b981] text-white" />
              </div>
            </div>

            <p className="max-w-[240px] text-[13px] leading-relaxed font-medium text-slate-500">
              No upcoming call or meeting follow-ups for this period
            </p>
          </div>

          {/* Bottom spacing anchor */}
          <div className="h-4" />
        </div>
      </div>
    </div>
  );
}
