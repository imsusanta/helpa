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
import {
  buildVisibleNavigation,
  validateVisibleNavigation,
  type SidebarNavItem,
} from '@/components/layout/sidebar-navigation';

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export const NAV: SidebarNavItem<React.ElementType>[] = [
  { id: 'dashboard', label: 'Dashboard', href: '/dashboard', icon: Home },
  {
    id: 'sales',
    label: 'Sales',
    icon: LineChart,
    children: [
      { id: 'sales-leads', label: 'Leads', href: '/leads' },
      { id: 'sales-customers', label: 'Customers', href: '/customers' },
      { id: 'sales-deals', label: 'Deals', href: '/pipelines' },
      { id: 'sales-quotations', label: 'Quotations', href: '/quotations' },
    ],
  },
  {
    id: 'conversations',
    label: 'Conversations',
    icon: MessageSquare,
    children: [
      { id: 'conversations-inbox', label: 'Inbox', href: '/inbox' },
      {
        id: 'conversations-follow-ups',
        label: 'Follow-ups',
        href: '/follow-ups',
      },
      {
        id: 'conversations-meetings',
        label: 'Meetings',
        href: '/appointments',
      },
    ],
  },
  {
    id: 'marketing',
    label: 'Marketing',
    icon: Megaphone,
    children: [
      { id: 'marketing-campaigns', label: 'Campaigns', href: '/broadcasts' },
      {
        id: 'marketing-reports',
        label: 'Campaign Reports',
        href: '/campaign-reports',
      },
      { id: 'marketing-lead-forms', label: 'Lead Forms', href: '/lead-forms' },
    ],
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    icon: MessageCircle,
    children: [
      {
        id: 'whatsapp-patient-list',
        label: 'Patient List',
        href: '/patients',
        hospitalOnly: true,
        activeHrefs: ['/contacts'],
      },
      { id: 'whatsapp-campaigns', label: 'Campaigns', href: '/broadcasts' },
      {
        id: 'whatsapp-api',
        label: 'WhatsApp API',
        href: '/settings?tab=whatsapp',
      },
    ],
  },
  {
    id: 'automation-ai',
    label: 'Automation & AI',
    icon: Bot,
    children: [
      { id: 'automation-chatbot', label: 'Chatbot', href: '/chatbot' },
      { id: 'automation-faq', label: 'FAQ Bot', href: '/faq-bot' },
      {
        id: 'automation-assistant',
        label: 'AI Assistant',
        href: '/ai-assistant',
      },
      { id: 'automation-rules', label: 'Automations', href: '/automations' },
      {
        id: 'automation-knowledge',
        label: 'AI Knowledge Base',
        href: '/knowledge-base',
      },
    ],
  },
  {
    id: 'services',
    label: 'Products / Services',
    href: '/services',
    icon: Package,
  },
  {
    id: 'billing',
    label: 'Billing',
    icon: BadgeDollarSign,
    children: [
      { id: 'billing-invoices', label: 'Invoices', href: '/invoices' },
      {
        id: 'billing-settings',
        label: 'Billing Settings',
        href: '/settings?tab=billing',
      },
    ],
  },
  {
    id: 'manage-tags',
    label: 'Tags',
    href: '/settings?tab=tags',
    icon: Settings2,
  },
  {
    id: 'integrations',
    label: 'Integrations',
    href: '/integrations',
    icon: LayoutGrid,
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    children: [
      {
        id: 'settings-profile',
        label: 'Profile',
        href: '/settings?tab=profile',
      },
      {
        id: 'settings-team',
        label: 'Team Members',
        href: '/settings?tab=team',
      },
    ],
  },
  {
    id: 'admin',
    label: 'Admin Panel',
    icon: ShieldCheck,
    href: '/admin',
    superAdminOnly: true,
    children: [
      { id: 'admin-overview', label: 'Overview', href: '/admin' },
      { id: 'admin-tenants', label: 'Tenants', href: '/admin/tenants' },
      {
        id: 'admin-subscriptions',
        label: 'Subscriptions',
        href: '/admin/subscriptions',
      },
      { id: 'admin-ai', label: 'AI Infrastructure', href: '/admin/ai' },
      { id: 'admin-payments', label: 'Payments', href: '/admin/payments' },
      {
        id: 'admin-whatsapp',
        label: 'WhatsApp Numbers',
        href: '/admin/whatsapp',
      },
      {
        id: 'admin-settings',
        label: 'System Settings',
        href: '/admin/settings',
      },
    ],
  },
];

function pathIsActive(pathname: string, href?: string, aliases: string[] = []) {
  if (!href) return false;
  return [href, ...aliases].some((candidate) => {
    const clean = candidate.split('?')[0];
    return (
      pathname === clean ||
      (clean !== '/dashboard' && pathname.startsWith(`${clean}/`))
    );
  });
}

export function Sidebar({ open = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { profile, accountRole, isSuperAdmin } = useAuth();
  const { terminology, currentIndustry, manifest, isRouteAllowed } =
    useWorkspace();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    sales: true,
    conversations: false,
    marketing: false,
    whatsapp: false,
    'automation-ai': false,
    billing: false,
    admin: false,
    settings: false,
  });

  const visibleNav = useMemo(
    () =>
      buildVisibleNavigation({
        navigation: NAV,
        terminology,
        currentIndustry,
        isSuperAdmin,
        isRouteAllowed,
        accountRole,
        routeRoleRequirements: manifest.sidebar,
      }),
    [
      accountRole,
      currentIndustry,
      isRouteAllowed,
      isSuperAdmin,
      manifest.sidebar,
      terminology,
    ]
  );

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    for (const issue of validateVisibleNavigation(visibleNav)) {
      console.error(`[navigation] ${issue.message}`);
    }
  }, [visibleNav]);

  const activeParent = useMemo(() => {
    for (const item of visibleNav)
      if (
        item.children?.some((child) =>
          pathIsActive(pathname, child.href, child.activeHrefs)
        )
      )
        return item.id;
    return (
      visibleNav.find((item) => pathIsActive(pathname, item.href))?.id ||
      'dashboard'
    );
  }, [pathname, visibleNav]);

  useEffect(() => {
    if (activeParent && activeParent !== 'dashboard') {
      setExpanded((prev) => ({ ...prev, [activeParent]: true }));
    }
  }, [activeParent]);

  const toggle = (id: string) =>
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

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
              const isDashboard = item.id === 'dashboard';
              const activeDirect = pathIsActive(pathname, item.href);
              const isParentActive = activeParent === item.id;
              const isExpanded = expanded[item.id];
              const hasChildren = Boolean(item.children?.length);

              if (!hasChildren && item.href) {
                return (
                  <Link
                    key={item.id}
                    data-nav-id={item.id}
                    data-nav-href={item.href}
                    data-nav-source-label={item.sourceLabel}
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
                <div
                  key={item.id}
                  data-nav-id={item.id}
                  data-nav-source-label={item.sourceLabel}
                  className="space-y-0.5"
                >
                  <button
                    type="button"
                    onClick={() => toggle(item.id)}
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
                        const active = pathIsActive(
                          pathname,
                          child.href,
                          child.activeHrefs
                        );
                        return (
                          <Link
                            key={child.id}
                            data-nav-id={child.id}
                            data-nav-parent-id={item.id}
                            data-nav-href={child.href}
                            data-nav-source-label={child.sourceLabel}
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
                className="h-9 w-9 shrink-0 rounded-full border border-emerald-500/30 object-cover shadow-xs"
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = 'none';
                  const fallback = e.currentTarget
                    .nextElementSibling as HTMLElement;
                  if (fallback) fallback.style.display = 'flex';
                }}
              />
            ) : null}
            <div
              className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#10b981] text-xs font-bold text-white shadow-xs',
                profile?.avatar_url && 'hidden'
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
