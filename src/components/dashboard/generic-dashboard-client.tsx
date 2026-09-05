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
import type { LeadSourceSlice } from '@/lib/dashboard/lead-sources';
import { DashboardSetupChecklist } from './dashboard-setup-checklist';

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
    href: '/broadcasts',
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

/**
 * Metric cards share one minimum height so the coloured icon tile sits in
 * the same spot on every row, while still being allowed to grow when a
 * translated label wraps onto a second line. A fixed height would clip or
 * spill that wrapped label on narrow viewports.
 */
const METRIC_CARD_HEIGHT = 'min-h-[148px] overflow-hidden';

/**
 * The icon tile is 48px wide and inset 20px from the right edge, so the
 * value needs 68px of clearance. Reserve a little more than that so long
 * currency amounts never run underneath it.
 */
const METRIC_VALUE_PADDING = 'pr-20';

const LEAD_SOURCE_DOTS = ['#3b82f6', '#22c55e', '#f97316'] as const;

const EMPTY_LEAD_SOURCES: LeadSourceSlice[] = [
  { key: 'whatsapp', label: 'WhatsApp', count: 0, percent: 0 },
  { key: 'facebook', label: 'Facebook', count: 0, percent: 0 },
  { key: 'import', label: 'Import', count: 0, percent: 0 },
];

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

interface UpcomingFollowup {
  id: string;
  followup_type?: string;
  due_date?: string;
  patient?: { name?: string | null } | null;
}

interface CachedMetricsData {
  metrics: Record<string, number>;
  leadSources: LeadSourceSlice[];
  timestamp: number;
}
const metricsCache = new Map<string, CachedMetricsData>();
const METRICS_CACHE_TTL_MS = 60_000; // 1 minute

interface GenericDashboardClientProps {
  onResumeOnboarding?: () => void;
}

export function GenericDashboardClient({
  onResumeOnboarding,
}: GenericDashboardClientProps = {}) {
  const { terminology, isRouteAllowed } = useWorkspace();
  const { account, accountId, profile } = useAuth();
  const [range, setRange] = useState('30d');

  const cacheKey = `${accountId || ''}:${account?.industry || ''}:${range}`;
  const initialCache = metricsCache.get(cacheKey);

  const [loading, setLoading] = useState(!initialCache);
  const [metrics, setMetrics] = useState<Record<string, number>>(
    initialCache?.metrics || {}
  );
  const [upcomingFollowups, setUpcomingFollowups] = useState<
    UpcomingFollowup[]
  >([]);
  const [leadSources, setLeadSources] = useState<LeadSourceSlice[]>(
    initialCache?.leadSources || []
  );
  const userName =
    profile?.full_name?.split(' ')[0] || account?.name || 'susanta';

  useEffect(() => {
    if (!accountId) return;
    let cancelled = false;

    const currentCached = metricsCache.get(cacheKey);
    if (currentCached) {
      setMetrics(currentCached.metrics);
      setLeadSources(currentCached.leadSources);
      if (Date.now() - currentCached.timestamp < METRICS_CACHE_TTL_MS) {
        setLoading(false);
      }
    } else {
      setLoading(true);
    }

    fetch('/api/dashboard/metrics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ industry: account?.industry, range }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!cancelled && res.ok && data.success) {
          const freshMetrics = data.metrics || {};
          const freshSources = Array.isArray(data.lead_sources)
            ? data.lead_sources
            : [];
          setMetrics(freshMetrics);
          setLeadSources(freshSources);
          metricsCache.set(cacheKey, {
            metrics: freshMetrics,
            leadSources: freshSources,
            timestamp: Date.now(),
          });
        }
      })
      .catch((error) => console.error('Metrics fetch error:', error))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    fetch('/api/followups?status=upcoming')
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!cancelled && res.ok)
          setUpcomingFollowups(
            Array.isArray(data.followups) ? data.followups.slice(0, 5) : []
          );
      })
      .catch((error) => console.error('Follow-up fetch error:', error));
    return () => {
      cancelled = true;
    };
  }, [accountId, account?.industry, range, cacheKey]);

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
      metricCards
        .filter((card) => isRouteAllowed(card.href))
        .map((card) => {
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
    [isRouteAllowed, terminology]
  );

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-[1536px] space-y-5">
        <div className="h-16 animate-pulse rounded-2xl bg-white" />
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className={`animate-pulse rounded-2xl bg-white ${METRIC_CARD_HEIGHT}`}
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

      <DashboardSetupChecklist onResumeOnboarding={onResumeOnboarding} />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {contextualMetricCards.map((card) => {
          const Icon = card.icon;
          const value = getMetric(metrics, card.keys);
          const isWallet = card.key === 'wallet';
          return (
            <Link
              key={card.key}
              href={card.href}
              className={`group relative flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[0_2px_8px_rgba(15,23,42,0.04)] transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg ${METRIC_CARD_HEIGHT}`}
            >
              <div className="flex items-start justify-between gap-2 pr-1">
                <span className="line-clamp-2 min-w-0 text-[12px] font-bold tracking-[0.055em] text-[#64748b] uppercase group-hover:text-slate-900">
                  {card.label}
                </span>
                {card.filter && (
                  <span className="inline-flex h-6 shrink-0 items-center rounded-lg bg-slate-50 px-2 text-[10px] font-bold whitespace-nowrap text-slate-500">
                    {card.filter}
                  </span>
                )}
              </div>

              <div className={METRIC_VALUE_PADDING}>
                <div className="text-[34px] leading-none font-extrabold tracking-[-0.03em] text-[#0f172a]">
                  {formatValue(value, isWallet)}
                </div>
              </div>

              <div
                className={`absolute right-5 bottom-5 flex h-12 w-12 items-center justify-center rounded-xl shadow-[0_4px_10px_rgba(15,23,42,0.10)] transition-transform group-hover:scale-105 ${iconBgClasses[card.tone]}`}
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
                  val: getMetric(metrics, ['leads_new', 'leads_total']),
                },
                {
                  label: 'Contacted / Assigned',
                  val: getMetric(metrics, ['leads_contacted']),
                },
                {
                  label: 'Qualified / Won',
                  val: getMetric(metrics, ['leads_converted']),
                },
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
                {totalPipeline}
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
              {(leadSources.length > 0 ? leadSources : EMPTY_LEAD_SOURCES).map(
                (source, index) => (
                  <div key={source.key} className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{
                        backgroundColor:
                          LEAD_SOURCE_DOTS[index % LEAD_SOURCE_DOTS.length],
                      }}
                    />
                    <span>{source.label}</span>
                    <strong className="ml-auto font-bold text-[#0f172a]">
                      {source.percent}%
                    </strong>
                  </div>
                )
              )}
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
          {upcomingFollowups.length === 0 ? (
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
          ) : (
            <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 py-4">
              {upcomingFollowups.map((followup) => (
                <Link
                  key={followup.id}
                  href="/follow-ups"
                  className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5 hover:border-slate-200"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-[#0f172a]">
                      {followup.patient?.name || terminology.person}
                    </p>
                    <p className="truncate text-[12px] text-slate-500">
                      {followup.followup_type || terminology.followUp}
                    </p>
                  </div>
                  <span className="shrink-0 text-[11px] font-semibold text-slate-500">
                    {followup.due_date
                      ? new Date(followup.due_date).toLocaleDateString()
                      : ''}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
