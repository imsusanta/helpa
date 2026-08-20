'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Bot,
  Boxes,
  ChevronDown,
  ChevronRight,
  ContactRound,
  GitBranch,
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  PanelLeftClose,
  Settings,
  Tags,
  Wallet,
  Webhook,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

type NavItem = {
  label: string;
  href?: string;
  icon: React.ElementType;
  children?: { label: string; href: string }[];
};

const NAV: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Sales', icon: Activity, children: [
    { label: 'Leads', href: '/contacts' }, { label: 'Customers', href: '/customers' },
    { label: 'Deals', href: '/pipelines' }, { label: 'Quotations', href: '/quotations' },
  ]},
  { label: 'Conversations', icon: MessageSquare, children: [
    { label: 'Inbox', href: '/inbox' }, { label: 'Follow-ups', href: '/follow-ups' }, { label: 'Appointments', href: '/appointments' },
  ]},
  { label: 'Marketing', icon: Megaphone, children: [
    { label: 'Campaigns', href: '/broadcasts' }, { label: 'Lead Forms', href: '/forms' }, { label: 'Media Library', href: '/media' },
  ]},
  { label: 'WhatsApp', icon: MessageSquare, children: [
    { label: 'Templates', href: '/templates' }, { label: 'Forms', href: '/forms' }, { label: 'Broadcast Logs', href: '/broadcasts' },
    { label: 'WhatsApp API', href: '/settings?tab=whatsapp' }, { label: 'API Docs', href: '/api-docs' },
  ]},
  { label: 'Automation & AI', icon: Bot, children: [
    { label: 'Chatbot', href: '/chatbot' }, { label: 'FAQ Bot', href: '/faq-bot' }, { label: 'AI Assistant', href: '/ai-assistant' }, { label: 'Automations', href: '/automations' },
  ]},
  { label: 'Products / Services', href: '/services', icon: Boxes },
  { label: 'Billing', icon: Wallet, children: [
    { label: 'Invoices', href: '/billing/invoices' }, { label: 'Reports', href: '/billing/reports' }, { label: 'Reminders', href: '/billing/reminders' }, { label: 'Billing Settings', href: '/billing/settings' },
  ]},
  { label: 'Manage', icon: ContactRound, children: [
    { label: 'Tags', href: '/settings?tab=tags' }, { label: 'Columns', href: '/settings?tab=columns' }, { label: 'Opt-in / Opt-out', href: '/settings?tab=consent' }, { label: 'Webhook Events', href: '/settings?tab=webhooks' },
  ]},
  { label: 'Integrations', href: '/integrations', icon: GitBranch },
  { label: 'Developers', icon: Webhook, children: [
    { label: 'Connection Key', href: '/settings?tab=api' }, { label: 'API Docs', href: '/api-docs' }, { label: 'Webhooks', href: '/settings?tab=webhooks' },
  ]},
  { label: 'Settings', icon: Settings, children: [
    { label: 'Profile', href: '/settings?tab=profile' }, { label: 'Roles & Permissions', href: '/settings?tab=roles' }, { label: 'Team Members', href: '/settings?tab=team' }, { label: 'Organization', href: '/settings?tab=organization' },
  ]},
];

function pathIsActive(pathname: string, href?: string) {
  if (!href) return false;
  const clean = href.split('?')[0];
  return pathname === clean || (clean !== '/dashboard' && pathname.startsWith(`${clean}/`));
}

export function Sidebar({ open = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    Sales: true, Conversations: true, Marketing: false, WhatsApp: false, 'Automation & AI': false,
    Billing: false, Manage: false, Developers: false, Settings: false,
  });

  const activeParent = useMemo(() => {
    for (const item of NAV) if (item.children?.some((child) => pathIsActive(pathname, child.href))) return item.label;
    return NAV.find((item) => pathIsActive(pathname, item.href))?.label || 'Dashboard';
  }, [pathname]);

  useEffect(() => {
    if (activeParent) setExpanded((prev) => ({ ...prev, [activeParent]: true }));
  }, [activeParent]);

  const toggle = (label: string) => setExpanded((prev) => ({ ...prev, [label]: !prev[label] }));

  return (
    <>
      <div className={cn('fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-[1px] transition-opacity lg:hidden', open ? 'opacity-100' : 'pointer-events-none opacity-0')} onClick={onClose} />
      <aside className={cn(
        'fixed inset-y-0 left-0 z-50 flex w-[293px] shrink-0 flex-col bg-[#0d1729] text-white transition-transform duration-200 lg:static lg:z-auto lg:translate-x-0',
        open ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="flex h-[80px] items-center justify-between border-b border-white/8 px-[18px]">
          <Link href="/dashboard" className="flex items-center gap-3" onClick={onClose}>
            <img src="/helpa-logo.svg" alt="Helpa" className="h-10 w-10 rounded-xl" />
            <div className="leading-tight"><div className="text-[19px] font-extrabold tracking-tight text-white">Helpa</div><div className="text-[12px] font-medium text-slate-400">WhatsApp CRM</div></div>
          </Link>
          <button className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white lg:hidden" onClick={onClose}><X className="h-5 w-5" /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-[18px] py-3 [scrollbar-color:#334155_transparent]">
          <nav className="space-y-1">
            {NAV.map((item) => {
              const Icon = item.icon; const isParentActive = activeParent === item.label; const isExpanded = expanded[item.label]; const hasChildren = Boolean(item.children?.length); const activeDirect = pathIsActive(pathname, item.href);
              if (!hasChildren && item.href) return (
                <Link key={item.label} href={item.href} onClick={onClose} className={cn(
                  'group flex h-[48px] items-center gap-3 rounded-xl px-3.5 text-[14px] font-semibold transition-colors',
                  activeDirect ? 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/15' : 'text-slate-300 hover:bg-white/5 hover:text-white'
                )}>
                  <Icon className={cn('h-[18px] w-[18px]', activeDirect ? 'text-emerald-400' : 'text-slate-400 group-hover:text-slate-200')} /><span>{item.label}</span>
                </Link>
              );
              return (
                <div key={item.label}>
                  <button type="button" onClick={() => toggle(item.label)} className={cn(
                    'group flex h-[48px] w-full items-center gap-3 rounded-xl px-3.5 text-left text-[14px] font-semibold transition-colors',
                    isParentActive ? 'bg-slate-800/80 text-white ring-1 ring-white/5' : 'text-slate-300 hover:bg-white/5 hover:text-white'
                  )}>
                    <Icon className={cn('h-[18px] w-[18px]', isParentActive ? 'text-emerald-400' : 'text-slate-400 group-hover:text-slate-200')} />
                    <span className="flex-1">{item.label}</span>{isExpanded ? <ChevronDown className="h-4 w-4 text-slate-500" /> : <ChevronRight className="h-4 w-4 text-slate-500" />}
                  </button>
                  {isExpanded && item.children && <div className="ml-4 border-l border-white/8 py-1 pl-3">
                    {item.children.map((child) => { const active = pathIsActive(pathname, child.href); return (
                      <Link key={child.label} href={child.href} onClick={onClose} className={cn('flex h-9 items-center rounded-lg px-3 text-[13px] font-medium transition-colors', active ? 'bg-white/8 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-slate-100')}>{child.label}</Link>
                    ); })}
                  </div>}
                </div>
              );
            })}
          </nav>
        </div>

        <div className="border-t border-white/8 bg-[#0b1424] p-4">
          <Link href="/settings?tab=profile" className="flex items-center gap-3 rounded-xl px-1 py-2 hover:bg-white/5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-xs font-extrabold text-white">SU</div>
            <div className="min-w-0 flex-1"><div className="truncate text-sm font-bold text-white">Helpa Admin</div><div className="text-xs text-slate-400">Administrator</div></div>
            <PanelLeftClose className="h-4 w-4 text-slate-500" />
          </Link>
        </div>
      </aside>
    </>
  );
}
