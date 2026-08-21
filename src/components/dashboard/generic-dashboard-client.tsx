'use client';

import { useEffect, useState } from 'react';
import { Calendar, ChevronDown, FileText, Inbox, Megaphone, ReceiptText, Send, Users, WalletCards } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

const cards = [
  ['TOTAL LEADS', 'leads_total', 'All Time', 'blue', Users],
  ['TOTAL CUSTOMERS', 'customers_total', 'All Time', 'indigo', Users],
  ['QUOTATIONS', 'quotations_total', 'This Month', 'teal', FileText],
  ['INVOICES', 'invoices_total', 'This Month', 'green', ReceiptText],
  ['CAMPAIGNS', 'campaigns_total', '', 'purple', Megaphone],
  ['MESSAGES SENT', 'messages_sent', '', 'teal', Send],
  ['MESSAGES RECEIVED', 'messages_received', '', 'blue', Inbox],
  ['WALLET BALANCE', 'wallet_balance', '', 'orange', WalletCards],
] as const;

const iconTone: Record<string, string> = {
  blue: 'bg-blue-500', indigo: 'bg-indigo-500', teal: 'bg-teal-500', green: 'bg-emerald-500', purple: 'bg-violet-500', orange: 'bg-orange-500',
};

function valueFor(metrics: Record<string, number>, key: string) {
  const aliases: Record<string, string[]> = {
    leads_total: ['leads_total', 'total_leads', 'contacts_total', 'active_patients', 'active_members'],
    customers_total: ['customers_total', 'total_customers', 'active_patients', 'active_members'],
    quotations_total: ['quotations_total', 'quotations', 'pending_enquiries'],
    invoices_total: ['invoices_total', 'invoices'],
    campaigns_total: ['campaigns_total'],
    messages_sent: ['messages_sent', 'sent_messages'],
    messages_received: ['messages_received', 'received_messages', 'unread_chats', 'conversations_active'],
    wallet_balance: ['wallet_balance', 'balance'],
  };
  return (aliases[key] || [key]).reduce<number | undefined>((found, name) => found ?? (typeof metrics[name] === 'number' ? metrics[name] : undefined), undefined) ?? 0;
}

function Filter({ children }: { children: string }) {
  return <button className="inline-flex h-8 items-center gap-1 rounded-full border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-600 shadow-sm">{children}<ChevronDown className="h-3 w-3 text-slate-400" /></button>;
}

function Panel({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_2px_8px_rgba(15,23,42,0.045)]"><div className="flex h-[52px] items-center justify-between border-b border-slate-100 px-5"><h2 className="text-[16px] font-extrabold text-slate-800">{title}</h2>{action}</div>{children}</section>;
}

export function GenericDashboardClient() {
  const { account, accountId, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<Record<string, number>>({});
  const name = profile?.full_name?.split(' ')[0] || account?.name?.split(' ')[0] || 'susanta';

  useEffect(() => {
    if (!accountId) return;
    let cancelled = false;
    fetch('/api/dashboard/metrics', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ industry: account?.industry }) })
      .then(async (r) => { const data = await r.json(); if (!cancelled && r.ok && data.success) setMetrics(data.metrics || {}); })
      .catch((e) => console.error('Metrics fetch error:', e))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [accountId, account?.industry]);

  if (loading) return <div className="mx-auto max-w-[1400px] space-y-4"><div className="h-20 animate-pulse rounded-2xl bg-white" /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <div key={i} className={`animate-pulse rounded-2xl bg-white ${i < 4 ? 'h-[148px]' : 'h-[180px]'}`} />)}</div></div>;

  const totalLeads = valueFor(metrics, 'leads_total');

  return <div className="flex min-h-[calc(100vh-62px)] flex-col">
    <main className="mx-auto w-full max-w-[1400px] flex-1 space-y-5 px-5 py-8 xl:px-6">
      <div className="flex items-start justify-between gap-4">
        <div><h1 className="text-[30px] font-extrabold leading-tight tracking-[-0.035em] text-[#0f172a]">Welcome back, {name}! <span aria-hidden>👋</span></h1><p className="mt-1 text-[15px] font-medium text-slate-500">Here’s what’s happening with your business today.</p></div>
        <button className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 shadow-sm"><Calendar className="h-4 w-4 text-slate-500" />Aug 16, 2026 – Aug 22, 2026</button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, key, filter, tone, Icon], i) => { const value = valueFor(metrics, key); const wallet = key === 'wallet_balance'; return <section key={key} className={`relative rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_8px_rgba(15,23,42,0.045)] ${i < 4 ? 'h-[148px]' : 'h-[180px]'}`}>
          <div className="flex items-start justify-between pr-1"><p className="text-[13px] font-bold tracking-[0.075em] text-[#64748b]">{label}</p>{filter && <Filter>{filter}</Filter>}</div>
          <div className={`mt-5 text-[34px] font-extrabold leading-none tracking-tight text-[#0f172a]`}>{wallet ? `₹${value.toFixed(2)}` : value.toLocaleString('en-IN')}</div>
          {wallet && <div className="mt-4 flex gap-2 text-[11px] font-bold"><span className="rounded-full bg-blue-50 px-2 py-1 text-blue-600">Normal: ₹0.00</span><span className="rounded-full bg-violet-50 px-2 py-1 text-violet-600">Offer: ₹0.00</span></div>}
          <div className={`absolute right-5 ${i < 4 ? 'top-[67px]' : 'top-5'} flex h-12 w-12 items-center justify-center rounded-xl ${iconTone[tone]} text-white shadow-lg`}><Icon className="h-5 w-5" /></div>
        </section>; })}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_1fr_1fr]">
        <Panel title="Sales Pipeline Overview"><div className="h-[307px] space-y-5 p-5">{[['New Leads', totalLeads], ['Contacted / Assigned', 0], ['Qualified / Won', 0]].map(([label, value]) => <div key={String(label)} className="flex items-center gap-3"><span className="w-[100px] shrink-0 text-[13px] font-medium text-slate-500">{label}</span><div className="h-7 flex-1 rounded-lg bg-slate-50"><div className="h-full rounded-lg bg-slate-100" style={{ width: `${Math.min(100, Number(value) * 10)}%` }} /></div><span className="w-7 text-right text-sm font-extrabold text-slate-800">{value}</span></div>)}<div className="flex justify-end border-t border-slate-100 pt-3 text-sm font-bold text-slate-500">Total Pipeline Leads: <span className="ml-1 text-slate-800">{totalLeads}</span></div></div></Panel>
        <Panel title="Top Lead Sources" action={<Filter>This Month</Filter>}><div className="flex h-[307px] flex-col justify-between p-5"><div className="flex flex-1 items-center justify-center"><div className="text-center"><div className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">Total</div><div className="mt-1 text-3xl font-extrabold text-slate-900">{totalLeads}</div></div></div><div className="grid grid-cols-2 gap-y-3 text-xs font-medium text-slate-500"><div className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-blue-500" />WhatsApp <b className="ml-auto text-slate-800">{totalLeads ? '100%' : '0%'}</b></div><div className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-emerald-500" />Facebook <b className="ml-auto text-slate-800">0%</b></div><div className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-orange-500" />Import <b className="ml-auto text-slate-800">0%</b></div></div></div></Panel>
        <Panel title="Upcoming Follow-ups" action={<div className="flex items-center gap-2"><Filter>All Days</Filter><a href="/follow-ups" className="text-xs font-bold text-blue-600">View All</a></div>}><div className="flex h-[307px] items-center justify-center px-5 text-center"><div><div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-500"><Calendar className="h-8 w-8" /></div><p className="max-w-[300px] text-sm leading-5 font-medium text-slate-500">No upcoming call or meeting follow-ups for this period</p></div></div></Panel>
      </div>
    </main>
    <footer className="flex h-[58px] shrink-0 items-center justify-between border-t border-slate-200 bg-white px-6 text-[13px] font-medium text-slate-500"><span>© 2026 Helpa Studio. All rights reserved.</span><span>v1.0.0</span></footer>
  </div>;
}
