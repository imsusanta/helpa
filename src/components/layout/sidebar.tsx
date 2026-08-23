'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  BadgeDollarSign,
  Bot,
  ChevronsUpDown,
  ChevronDown,
  ChevronRight,
  Code2,
  Home,
  LayoutGrid,
  LineChart,
  Megaphone,
  MessageCircle,
  MessageSquare,
  Package,
  Settings,
  Settings2,
  ShieldCheck,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { useWorkspace } from '@/hooks/use-workspace';

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

type NavItem = {
  label: string;
  href?: string;
  icon: React.ElementType;
  children?: { label: string; href: string }[];
  superAdminOnly?: boolean;
};

const NAV: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: Home },
  {
    label: 'Sales',
    icon: LineChart,
    children: [
      { label: 'Leads', href: '/leads' },
      { label: 'Customers', href: '/customers' },
      { label: 'Deals', href: '/pipelines' },
      { label: 'Quotations', href: '/quotations' },
      { label: 'Invoices', href: '/invoices' },
    ],
  },
  {
    label: 'Conversations',
    icon: MessageSquare,
    children: [
      { label: 'Inbox', href: '/inbox' },
      { label: 'Follow-ups', href: '/follow-ups' },
      { label: 'Meetings', href: '/appointments' },
      { label: 'Calls', href: '/follow-ups' },
    ],
  },
  {
    label: 'Marketing',
    icon: Megaphone,
    children: [
      { label: 'Campaigns', href: '/broadcasts' },
      { label: 'Campaign Reports', href: '/campaign-reports' },
      { label: 'Lead Forms', href: '/lead-forms' },
    ],
  },
  {
    label: 'WhatsApp',
    icon: MessageCircle,
    children: [
      { label: 'Inbox', href: '/inbox' },
      { label: 'Templates', href: '/templates' },
      { label: 'Forms', href: '/forms' },
      { label: 'Broadcasts', href: '/broadcasts' },
      { label: 'Broadcast Logs', href: '/broadcasts' },
      { label: 'WhatsApp API', href: '/settings?tab=whatsapp' },
      { label: 'API Docs', href: '/api-docs' },
    ],
  },
  {
    label: 'Automation & AI',
    icon: Bot,
    children: [
      { label: 'Chatbot', href: '/chatbot' },
      { label: 'FAQ Bot', href: '/faq-bot' },
      { label: 'AI Assistant', href: '/ai-assistant' },
      { label: 'Automations', href: '/automations' },
      { label: 'AI Knowledge Base', href: '/knowledge-base' },
    ],
  },
  { label: 'Products / Services', href: '/services', icon: Package },
  {
    label: 'Billing',
    icon: BadgeDollarSign,
    children: [
      { label: 'Invoices', href: '/invoices' },
      { label: 'Reports', href: '/billing/reports' },
      { label: 'Reminders', href: '/billing/reminders' },
      { label: 'Billing Settings', href: '/billing/settings' },
    ],
  },
  {
    label: 'Manage',
    icon: Settings2,
    children: [
      { label: 'Tags', href: '/settings?tab=tags' },
      { label: 'Columns', href: '/settings?tab=columns' },
      { label: 'Opt-in / Opt-out', href: '/settings?tab=consent' },
      { label: 'Webhook Events', href: '/settings?tab=webhooks' },
    ],
  },
  { label: 'Integrations', href: '/integrations', icon: LayoutGrid },
  {
    label: 'Developers',
    icon: Code2,
    children: [
      { label: 'Connection Key', href: '/settings?tab=api' },
      { label: 'API', href: '/settings?tab=api' },
      { label: 'Webhooks', href: '/settings?tab=webhooks' },
      { label: 'API Docs', href: '/api-docs' },
    ],
  },
  {
    label: 'Settings',
    icon: Settings,
    children: [
      { label: 'Profile', href: '/settings?tab=profile' },
      { label: 'Roles & Permissions', href: '/settings?tab=roles' },
      { label: 'Team Members', href: '/settings?tab=team' },
      { label: 'Organization', href: '/settings?tab=organization' },
    ],
  },
  {
    label: 'Admin Panel',
    icon: ShieldCheck,
    href: '/admin',
    superAdminOnly: true,
    children: [
      { label: 'Overview', href: '/admin' },
      { label: 'Tenants', href: '/admin/tenants' },
      { label: 'Subscriptions', href: '/admin/subscriptions' },
      { label: 'AI Infrastructure', href: '/admin/ai' },
      { label: 'Payments', href: '/admin/payments' },
      { label: 'WhatsApp Numbers', href: '/admin/whatsapp' },
      { label: 'System Settings', href: '/admin/settings' },
    ],
  },
];

function pathIsActive(pathname: string, href?: string) {
  if (!href) return false;
  const clean = href.split('?')[0];
  return (
    pathname === clean ||
    (clean !== '/dashboard' && pathname.startsWith(`${clean}/`))
  );
}

export function Sidebar({ open = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { profile, isSuperAdmin } = useAuth();
  const { terminology, isRouteAllowed } = useWorkspace();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    Sales: true,
    Conversations: false,
    Marketing: false,
    WhatsApp: false,
    'Automation & AI': false,
    Billing: false,
    Manage: false,
    Developers: false,
    'Admin Panel': false,
    Settings: false,
  });

  const visibleNav = useMemo(() => {
    const labelByHref: Record<string, string> = {
      '/leads': terminology.pipelineItems,
      '/customers': terminology.people,
      '/pipelines': terminology.pipelines,
      '/inbox': 'Inbox',
      '/follow-ups': terminology.followUps,
      '/appointments': terminology.meetings,
      '/broadcasts': terminology.campaigns,
      '/forms': `${terminology.pipelineItem} Forms`,
      '/services': terminology.services,
      '/billing/reports': terminology.reports,
      '/settings?tab=team': terminology.staffMembers,
    };

    return NAV.filter((item) => !item.superAdminOnly || isSuperAdmin)
      .map((item) => ({
        ...item,
        label:
          item.href === '/services'
            ? terminology.services
            : item.label === 'Conversations'
              ? terminology.conversations
              : item.label,
        children: item.children
          ?.filter((child) => isRouteAllowed(child.href.split('?')[0]))
          .map((child) => ({
            ...child,
            label: labelByHref[child.href] || child.label,
          })),
      }))
      .filter(
        (item) =>
          item.superAdminOnly ||
          (item.href ? isRouteAllowed(item.href.split('?')[0]) : true)
      );
  }, [isRouteAllowed, isSuperAdmin, terminology]);

  const activeParent = useMemo(() => {
    for (const item of visibleNav)
      if (item.children?.some((child) => pathIsActive(pathname, child.href)))
        return item.label;
    return (
      visibleNav.find((item) => pathIsActive(pathname, item.href))?.label ||
      'Dashboard'
    );
  }, [pathname, visibleNav]);

  useEffect(() => {
    if (activeParent && activeParent !== 'Dashboard') {
      setExpanded((prev) => ({ ...prev, [activeParent]: true }));
    }
  }, [activeParent]);

  const toggle = (label: string) =>
    setExpanded((prev) => ({ ...prev, [label]: !prev[label] }));

  return (
    <>
      {/* Mobile Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-xs transition-opacity lg:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
        onClick={onClose}
      />

      {/* Sidebar Aside */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[252px] shrink-0 flex-col bg-[#071426] text-white transition-transform duration-200 lg:static lg:z-auto lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Top Branding */}
        <div className="flex h-[76px] items-center justify-between px-5">
          <Link
            href="/dashboard"
            className="flex items-center gap-3.5"
            onClick={onClose}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/helpa-logo.png?v=4"
              alt="Helpa"
              className="h-10 w-10 rounded-xl object-contain shadow-xs"
            />
            <div className="leading-tight">
              <div className="text-[19px] font-extrabold tracking-tight text-white">
                Helpa
              </div>
              <div className="text-[12px] font-medium text-slate-400">
                Studio
              </div>
            </div>
          </Link>
          <button
            type="button"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-white lg:hidden"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation Menu */}
        <div className="min-h-0 flex-1 [scrollbar-width:thin] [scrollbar-color:#1e293b_transparent] overflow-y-auto px-3 py-2">
          <nav className="space-y-1">
            {visibleNav.map((item) => {
              const Icon = item.icon;
              const isDashboard = item.label === 'Dashboard';
              const activeDirect = pathIsActive(pathname, item.href);
              const isParentActive = activeParent === item.label;
              const isExpanded = expanded[item.label];
              const hasChildren = Boolean(item.children?.length);

              if (!hasChildren && item.href) {
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={onClose}
                    className={cn(
                      'group relative flex h-[44px] items-center gap-3 rounded-xl px-3.5 text-[14px] font-medium transition-all',
                      isDashboard && activeDirect
                        ? 'bg-emerald-500/15 text-white'
                        : activeDirect
                          ? 'bg-white/10 font-semibold text-white'
                          : 'text-slate-300 hover:bg-white/5 hover:text-white'
                    )}
                  >
                    {isDashboard && activeDirect && (
                      <span className="absolute top-2.5 bottom-2.5 left-0 w-[3.5px] rounded-full bg-[#10b981]" />
                    )}
                    <Icon
                      className={cn(
                        'h-[18px] w-[18px] shrink-0',
                        isDashboard && activeDirect
                          ? 'text-[#10b981]'
                          : activeDirect
                            ? 'text-white'
                            : 'text-slate-400 group-hover:text-slate-200'
                      )}
                    />
                    <span>{item.label}</span>
                  </Link>
                );
              }

              return (
                <div key={item.label} className="space-y-0.5">
                  <button
                    type="button"
                    onClick={() => toggle(item.label)}
                    className={cn(
                      'group flex h-[44px] w-full items-center gap-3 rounded-xl px-3.5 text-left text-[14px] font-medium transition-colors',
                      isParentActive && !isExpanded
                        ? 'font-semibold text-white'
                        : 'text-slate-300 hover:bg-white/5 hover:text-white'
                    )}
                  >
                    <Icon
                      className={cn(
                        'h-[18px] w-[18px] shrink-0',
                        isParentActive
                          ? 'text-slate-200'
                          : 'text-slate-400 group-hover:text-slate-200'
                      )}
                    />
                    <span className="flex-1">{item.label}</span>
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-slate-500" />
                    )}
                  </button>

                  {isExpanded && item.children && (
                    <div className="space-y-0.5 pt-0.5 pr-1 pb-1 pl-9">
                      {item.children.map((child) => {
                        const active = pathIsActive(pathname, child.href);
                        return (
                          <Link
                            key={child.label}
                            href={child.href}
                            onClick={onClose}
                            className={cn(
                              'flex h-8 items-center rounded-lg px-2.5 text-[13px] font-medium transition-colors',
                              active
                                ? 'font-semibold text-white'
                                : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'
                            )}
                          >
                            {child.label}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>

        {/* Bottom User Profile Section */}
        <div className="border-t border-white/[0.08] px-4 py-3.5">
          <Link
            href="/settings?tab=profile"
            className="flex items-center gap-3 rounded-xl px-1.5 py-1 transition-colors hover:bg-white/5"
          >
            {profile?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatar_url}
                alt={profile.full_name || 'Profile'}
                className="h-9 w-9 shrink-0 rounded-full object-cover border border-emerald-500/30 shadow-xs"
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = 'none';
                  const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                  if (fallback) fallback.style.display = 'flex';
                }}
              />
            ) : null}
            <div
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#10b981] text-xs font-bold text-white shadow-xs",
                profile?.avatar_url && "hidden"
              )}
            >
              {profile?.full_name
                ? profile.full_name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase()
                : 'SU'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-semibold text-white">
                {profile?.full_name || 'susanta lohar'}
              </div>
              <div className="text-[11px] text-slate-400 capitalize">
                {profile?.role || 'Admin'}
              </div>
            </div>
            <ChevronsUpDown className="h-3.5 w-3.5 text-slate-400" />
          </Link>
        </div>
      </aside>
    </>
  );
}
