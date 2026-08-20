'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Calendar,
  ChevronDown,
  FileText,
  Inbox,
  Megaphone,
  MessageSquare,
  Plus,
  ReceiptText,
  RefreshCw,
  Send,
  Users,
  WalletCards,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { getIndustryModule } from '@/modules/registry';

const metricCards = [
  { key: 'leads', label: 'TOTAL LEADS', tone: 'blue', icon: Users, keys: ['leads_total', 'total_leads', 'contacts_total', 'active_patients', 'active_members'] },
  { key: 'customers', label: 'TOTAL CUSTOMERS', tone: 'indigo', icon: Users, keys: ['customers_total', 'total_customers', 'active_patients', 'active_members'] },
  { key: 'quotations', label: 'QUOTATIONS', tone: 'teal', icon: FileText, keys: ['quotations_total', 'quotations', 'pending_enquiries'] },
  { key: 'invoices', label: 'INVOICES', tone: 'green', icon: ReceiptText, keys: ['invoices_total', 'invoices'] },
  { key: 'campaigns', label: 'CAMPAIGNS', tone: 'purple', icon: Megaphone, keys: ['campaigns_total'] },
  { key: 'sent', label: 'MESSAGES SENT', tone: 'teal', icon: Send, keys: ['messages_sent', 'sent_messages'] },
  { key: 'received', label: 'MESSAGES RECEIVED', tone: 'blue', icon: Inbox, keys: ['messages_received', 'received_messages', 'unread_chats', 'conversations_active'] },
  { key: 'wallet', label: 'WALLET BALANCE', tone: 'orange', icon: WalletCards, keys: ['wallet_balance', 'balance'] },
] as const;

const toneClasses: Record<string, string> = {
  blue: 'bg-blue-500 text-white shadow-blue-500/20',
  indigo: 'bg-indigo-500 text-white shadow-indigo-500/20',
  teal: 'bg-teal-500 text-white shadow-teal-500/20',
  green: 'bg-emerald-500 text-white shadow-emerald-500/20',
  purple: 'bg-violet-500 text-white shadow-violet-500/20',
  orange: 'bg-orange-500 text-white shadow-orange-500/20',
};

function getMetric(metrics: Record<string, number>, keys: readonly string[]) {
  for (const key of keys) {
    if (typeof metrics[key] === 'number') return metrics[key];
  }
  return 0;
}

function formatValue(value: number, currency = false) {
  if (currency) return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return value.toLocaleString('en-IN');
}

function FilterPill({ children }: { children: React.ReactNode }) {
  return (
    <button className="inline-flex h-9 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-600 shadow-sm hover:bg-slate-50">
      {children}
      <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
    </button>
  );
}

function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.05)] ${className}`}>{children}</section>;
}

export function GenericDashboardClient() {
  const { account, accountId, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<Record<string, number>>({});
  const [greeting, setGreeting] = useState('Welcome back');

  const activeModule = getIndustryModule(account?.industry);
  const userName = profile?.full_name?.split(' ')[0] || account?.name || 'there';

  useEffect(() => {
    const hr = new Date().getHours();
    if (hr < 12) setGreeting('Good morning');
    else if (hr < 18) setGreeting('Good afternoon');
    else setGreeting('Good evening');
  }, []);

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
        if (!cancelled && res.ok && data.success) setMetrics(data.metrics || {});
      })
      .catch((error) => console.error('Metrics fetch error:', error))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [accountId, account?.industry]);

  const totalPipeline = useMemo(() => {
    return getMetric(metrics, ['leads_total', 'total_leads', 'contacts_total', 'active_patients', 'active_members']);
  }, [metrics]);

  if (loading) {
    return (
      <div className="mx-auto max-w-[1400px] space-y-5">
        <div className="h-20 animate-pulse rounded-2xl bg-white" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-36 animate-pulse rounded-2xl bg-white" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-4 pb-8">
      {/* Page heading */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-tight text-[#0f172a] sm:text-[30px]">
            {greeting}, {userName}! <span aria-hidden>👋</span>
          </h1>
          <p className="mt-1 text-[15px] font-medium text-slate-500">Here&apos;s what&apos;s happening with your business today.</p>
        </div>
        <button className="inline-flex h-11 items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 shadow-sm hover:bg-slate-50">
          <Calendar className="h-4 w-4 text-slate-500" />
          Aug 16, 2026 – Aug 22, 2026
        </button>
      </div>

      {/* KPI grid */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metricCards.map((card) => {
          const Icon = card.icon;
          const value = getMetric(metrics, card.keys);
          const isWallet = card.key === 'wallet';
          return (
            <Panel key={card.key} className="min-h-[142px] p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-bold tracking-[0.08em] text-slate-500">{card.label}</p>
                    <FilterPill>{card.key === 'leads' || card.key === 'customers' ? 'All Time' : card.key === 'campaigns' || card.key === 'sent' || card.key === 'received' ? 'This Month' : ''}</FilterPill>
                  </div>
                  <div className="mt-5 text-[34px] font-extrabold leading-none tracking-tight text-[#0f172a]">
                    {formatValue(value, isWallet)}
                  </div>
                  {isWallet && (
                    <div className="mt-3 flex gap-2 text-[11px] font-bold">
                      <span className="rounded-full bg-blue-50 px-2 py-1 text-blue-600">Normal: ₹0.00</span>
                      <span className="rounded-full bg-violet-50 px-2 py-1 text-violet-600">Offer: ₹0.00</span>
                    </div>
                  )}
                </div>
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl shadow-lg ${toneClasses[card.tone]}`}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </Panel>
          );
        })}
      </div>

      {/* Lower dashboard */}
      <div className="grid gap-4 xl:grid-cols-[1.05fr_1fr_1fr]">
        <Panel className="min-h-[330px]">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="text-[16px] font-extrabold text-slate-800">Sales Pipeline Overview</h2>
            <Link href="/pipelines" className="text-xs font-bold text-blue-600 hover:underline">View pipeline</Link>
          </div>
          <div className="space-y-5 p-5">
            {[
              ['New Leads', totalPipeline],
              ['Contacted / Assigned', 0],
              ['Qualified / Won', 0],
            ].map(([label, value]) => (
              <div key={label as string} className="flex items-center gap-3">
                <span className="w-[116px] shrink-0 text-[13px] font-medium text-slate-500">{label}</span>
                <div className="h-8 flex-1 overflow-hidden rounded-lg bg-slate-50">
                  <div className="h-full rounded-lg bg-slate-100" style={{ width: `${Math.min(100, Number(value) * 10)}%` }} />
                </div>
                <span className="w-8 text-right text-sm font-extrabold text-slate-800">{value}</span>
              </div>
            ))}
            <div className="flex items-center justify-end border-t border-slate-100 pt-4 text-sm font-bold text-slate-500">
              Total Pipeline Leads: <span className="ml-1 text-slate-800">{totalPipeline}</span>
            </div>
          </div>
        </Panel>

        <Panel className="min-h-[330px]">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="text-[16px] font-extrabold text-slate-800">Top Lead Sources</h2>
            <FilterPill>This Month</FilterPill>
          </div>
          <div className="flex h-[270px] flex-col justify-between p-5">
            <div className="flex flex-1 items-center justify-center">
              <div className="text-center">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Total</div>
                <div className="mt-1 text-3xl font-extrabold text-slate-900">{totalPipeline}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-y-3 text-xs font-medium text-slate-500">
              <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-blue-500" />WhatsApp <b className="ml-auto text-slate-800">{totalPipeline ? '100%' : '0%'}</b></div>
              <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />Facebook <b className="ml-auto text-slate-800">0%</b></div>
              <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-orange-500" />Import <b className="ml-auto text-slate-800">0%</b></div>
            </div>
          </div>
        </Panel>

        <Panel className="min-h-[330px]">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="text-[16px] font-extrabold text-slate-800">Upcoming Follow-ups</h2>
            <div className="flex items-center gap-2">
              <FilterPill><Calendar className="h-3.5 w-3.5" />All Days</FilterPill>
              <Link href="/follow-ups" className="text-xs font-bold text-blue-600">View All</Link>
            </div>
          </div>
          <div className="flex h-[270px] items-center justify-center px-5 text-center">
            <div>
              <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-slate-50 text-slate-400">
                <Calendar className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium text-slate-500">No upcoming call or meeting follow-ups for this period</p>
            </div>
          </div>
        </Panel>
      </div>

      {/* Small utility strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-3 shadow-sm">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          Helpa AI is ready to handle new WhatsApp conversations.
        </div>
        <div className="flex items-center gap-2">
          <Link href="/inbox" className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-slate-900 px-3 text-xs font-bold text-white hover:bg-slate-800"><MessageSquare className="h-3.5 w-3.5" /> Open Inbox</Link>
          <Link href="/contacts" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-600 hover:bg-slate-50"><Plus className="h-3.5 w-3.5" /> Add Lead</Link>
        </div>
      </div>
    </div>
  );
}
