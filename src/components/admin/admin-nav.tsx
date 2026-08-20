'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Shield,
  LayoutDashboard,
  Building2,
  CreditCard,
  Bot,
  Settings,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface AdminNavProps {
  onRefresh?: () => void;
  loading?: boolean;
  title?: string;
  description?: string;
  children?: React.ReactNode;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'OVERVIEW',
    items: [
      {
        href: '/admin',
        label: 'Dashboard',
        icon: LayoutDashboard,
        exact: true,
      },
    ],
  },
  {
    title: 'BUSINESSES',
    items: [
      {
        href: '/admin/subscribers',
        label: 'Businesses',
        icon: Building2,
      },
    ],
  },
  {
    title: 'REVENUE',
    items: [
      {
        href: '/admin/plans',
        label: 'Plans & Pricing',
        icon: CreditCard,
      },
    ],
  },
  {
    title: 'AI & WHATSAPP',
    items: [
      {
        href: '/admin/ai',
        label: 'AI Settings',
        icon: Bot,
      },
    ],
  },
  {
    title: 'SYSTEM',
    items: [
      {
        href: '/admin/settings',
        label: 'Settings',
        icon: Settings,
      },
    ],
  },
];

const ROUTE_DESCRIPTIONS: Record<
  string,
  { title: string; description: string }
> = {
  '/admin': {
    title: 'Dashboard',
    description:
      'Platform health metrics, multi-tenant subscription revenue, and active workspace overview.',
  },
  '/admin/subscribers': {
    title: 'Businesses',
    description:
      'Manage registered tenant organizations, subscription states, and workspace overrides.',
  },
  '/admin/plans': {
    title: 'Plans & Pricing',
    description:
      'Configure subscription tiers, setup fees, usage limits, and commercial feature flags.',
  },
  '/admin/ai': {
    title: 'AI Settings',
    description:
      'Configure global AI providers, model endpoints, rate limits, and fallback routing.',
  },
  '/admin/settings': {
    title: 'Settings',
    description:
      'Super Admin platform controls, maintenance mode, system keys, and administrative audit logs.',
  },
};

export function AdminNav({
  onRefresh,
  loading,
  title,
  description,
  children,
}: AdminNavProps) {
  const pathname = usePathname();

  const isCurrent = (item: NavItem) => {
    if (item.exact) {
      return pathname === item.href;
    }
    if (item.href === '/admin/subscribers' && pathname === '/admin/tenants') {
      return true;
    }
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  };

  const activeMeta = ROUTE_DESCRIPTIONS[pathname] || {
    title: title || 'Super Admin',
    description:
      description ||
      'Platform governance, subscriber accounts, pricing plans, and AI engine setup.',
  };

  const pageTitle = title || activeMeta.title;
  const pageDescription = description || activeMeta.description;

  return (
    <div className="flex flex-col items-start gap-6 lg:flex-row">
      {/* Left Vertical Super Admin Sidebar */}
      <aside className="border-border/80 bg-card/90 w-full shrink-0 rounded-2xl border p-4 shadow-xs backdrop-blur-md lg:sticky lg:top-4 lg:w-60">
        {/* Branding & Scope Header */}
        <div className="border-border/60 mb-4 flex items-center gap-2.5 border-b pb-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 font-bold text-emerald-600 shadow-xs dark:text-emerald-400">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-foreground text-sm font-bold tracking-tight">
                HELPA
              </span>
              <Badge
                variant="outline"
                className="border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400"
              >
                Admin
              </Badge>
            </div>
            <p className="text-muted-foreground text-[10px] font-medium">
              Super Admin
            </p>
          </div>
        </div>

        {/* Vertical Navigation Groups */}
        <nav className="space-y-4">
          {NAV_GROUPS.map((group) => (
            <div key={group.title} className="space-y-1">
              <h3 className="text-muted-foreground/70 px-2 text-[10px] font-bold tracking-[0.14em] uppercase">
                {group.title}
              </h3>
              <div className="space-y-0.5 pt-0.5">
                {group.items.map((item) => {
                  const active = isCurrent(item);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'flex items-center justify-between rounded-xl px-2.5 py-2 text-xs font-medium transition-all duration-150',
                        active
                          ? 'border border-emerald-500/20 bg-emerald-500/10 font-bold text-emerald-600 shadow-xs dark:text-emerald-400'
                          : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground border border-transparent'
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon
                          className={cn(
                            'size-4 shrink-0',
                            active
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-muted-foreground'
                          )}
                        />
                        <span>{item.label}</span>
                      </div>
                      {active && (
                        <span className="size-1.5 rounded-full bg-emerald-500" />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      {/* Main Right Content Workspace */}
      <main className="w-full min-w-0 flex-1 space-y-6">
        {/* Top Header Card with Dynamic Breadcrumb Title and Sync Trigger */}
        <div className="border-border/70 bg-card/60 flex flex-col gap-3 rounded-2xl border p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-foreground text-lg font-bold tracking-tight sm:text-xl">
                {pageTitle}
              </h1>
              <Badge className="border-emerald-500/20 bg-emerald-500/10 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                <Sparkles className="mr-1 size-3" /> Platform Control
              </Badge>
            </div>
            <p className="text-muted-foreground mt-0.5 text-xs">
              {pageDescription}
            </p>
          </div>

          {onRefresh && (
            <Button
              onClick={onRefresh}
              variant="outline"
              size="sm"
              disabled={loading}
              className="border-border hover:bg-muted h-8 gap-1.5 self-start rounded-lg text-xs font-medium sm:self-auto"
            >
              <RefreshCw
                className={cn('size-3.5', loading && 'animate-spin')}
              />
              Sync Data
            </Button>
          )}
        </div>

        {children}
      </main>
    </div>
  );
}
