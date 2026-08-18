'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity, BarChart3, Bot, Building2, ChevronDown, CreditCard,
  Gauge, LayoutDashboard, Menu, MessageCircle, RefreshCw, Search,
  Settings, Users, WalletCards, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AdminNavProps { onRefresh?: () => void; loading?: boolean }

type NavItem = { href?: string; label: string; icon: typeof LayoutDashboard };
const groups: Array<{ label: string; items: NavItem[] }> = [
  { label: 'Overview', items: [{ href: '/admin', label: 'Dashboard', icon: LayoutDashboard }] },
  { label: 'Business', items: [
    { href: '/admin/subscribers', label: 'Businesses', icon: Building2 },
    { label: 'Users', icon: Users }, { label: 'Industries', icon: BarChart3 },
  ]},
  { label: 'Revenue', items: [
    { href: '/admin/plans', label: 'Plans & Billing', icon: CreditCard },
    { label: 'Payments', icon: WalletCards },
  ]},
  { label: 'Communication', items: [
    { label: 'WhatsApp', icon: MessageCircle },
    { href: '/admin/ai', label: 'AI Settings', icon: Bot },
    { label: 'Usage', icon: Gauge },
  ]},
  { label: 'System', items: [
    { href: '/admin/settings', label: 'Settings', icon: Settings },
    { label: 'Activity', icon: Activity },
  ]},
];

export function AdminNav({ onRefresh, loading }: AdminNavProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href?: string) => href === '/admin' ? pathname === href : Boolean(href && pathname.startsWith(href));

  const sidebar = (
    <aside className="flex h-full w-64 flex-col border-r border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex h-20 items-center gap-3 border-b border-neutral-100 px-5 dark:border-neutral-900">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-sm font-bold text-white">H</div>
        <div><p className="text-sm font-semibold text-neutral-950 dark:text-white">Helpa Studio</p><p className="text-xs text-neutral-500">Super Admin</p></div>
      </div>
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5" aria-label="Super Admin navigation">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="mb-2 px-3 text-[11px] font-semibold tracking-wider text-neutral-400 uppercase">{group.label}</p>
            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon; const active = isActive(item.href);
                const classes = `flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors ${active ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300' : item.href ? 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-white' : 'cursor-not-allowed text-neutral-400 dark:text-neutral-600'}`;
                return item.href ? <Link key={item.label} href={item.href} onClick={() => setOpen(false)} className={classes}><Icon className="h-4 w-4" />{item.label}</Link> : <span key={item.label} className={classes} title="This section will appear when existing data support is available"><Icon className="h-4 w-4" />{item.label}<span className="ml-auto text-[10px] font-normal">Soon</span></span>;
              })}
            </div>
          </div>
        ))}
      </nav>
      <button className="m-3 flex min-h-14 items-center gap-3 rounded-xl border border-neutral-200 p-3 text-left hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-900 text-xs font-semibold text-white dark:bg-white dark:text-neutral-900">SL</div>
        <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">Susanta Lohar</p><p className="text-xs text-neutral-500">Owner</p></div><ChevronDown className="h-4 w-4 text-neutral-400" />
      </button>
    </aside>
  );

  return <>
    <div className="fixed inset-y-0 left-0 z-40 hidden lg:block">{sidebar}</div>
    <div className="sticky top-0 z-30 -mx-4 mb-6 flex h-16 items-center gap-3 border-b border-neutral-200 bg-white/95 px-4 backdrop-blur lg:hidden dark:border-neutral-800 dark:bg-neutral-950/95">
      <Button variant="ghost" size="icon" onClick={() => setOpen(true)} aria-label="Open navigation"><Menu className="h-5 w-5" /></Button>
      <div className="flex-1"><p className="text-sm font-semibold">Helpa Studio</p><p className="text-xs text-neutral-500">Super Admin</p></div>
      {onRefresh && <Button variant="ghost" size="icon" onClick={onRefresh} disabled={loading} aria-label="Refresh data"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></Button>}
    </div>
    {open && <div className="fixed inset-0 z-50 lg:hidden"><button className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} aria-label="Close navigation" /><div className="absolute inset-y-0 left-0 shadow-xl">{sidebar}<Button variant="ghost" size="icon" className="absolute top-4 right-3" onClick={() => setOpen(false)}><X className="h-5 w-5" /></Button></div></div>}
    <div className="fixed top-4 right-6 z-20 hidden items-center gap-2 lg:flex">
      <div className="relative"><Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-neutral-400" /><input aria-label="Global search" placeholder="Search businesses, users, payments..." className="h-10 w-72 rounded-lg border border-neutral-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 dark:border-neutral-800 dark:bg-neutral-950" /></div>
      {onRefresh && <Button variant="outline" size="icon" onClick={onRefresh} disabled={loading} aria-label="Refresh data"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></Button>}
    </div>
  </>;
}
