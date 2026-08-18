'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Shield,
  LayoutDashboard,
  Users,
  CreditCard,
  Brain,
  Settings,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AdminNavProps {
  onRefresh?: () => void;
  loading?: boolean;
}

export function AdminNav({ onRefresh, loading }: AdminNavProps) {
  const pathname = usePathname();

  const navItems = [
    { href: '/admin', label: 'Overview', icon: LayoutDashboard, exact: true },
    { href: '/admin/subscribers', label: 'Subscribers', icon: Users },
    { href: '/admin/plans', label: 'Plans & Pricing', icon: CreditCard },
    { href: '/admin/ai', label: 'AI Setup', icon: Brain },
    { href: '/admin/settings', label: 'Settings', icon: Settings },
  ];

  const isCurrent = (item: (typeof navItems)[0]) => {
    if (item.exact) {
      return pathname === item.href;
    }
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  };

  return (
    <div className="space-y-5 pb-2">
      {/* Super Admin Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-neutral-900 sm:text-2xl dark:text-neutral-100">
                  Super Admin
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                  <Sparkles className="h-3 w-3" /> Platform Control
                </span>
              </div>
              <p className="mt-0.5 text-xs text-neutral-500 sm:text-sm dark:text-neutral-400">
                Platform governance, subscriber accounts, pricing plans, and AI
                engine setup.
              </p>
            </div>
          </div>
        </div>
        {onRefresh && (
          <div className="flex items-center gap-2">
            <Button
              onClick={onRefresh}
              variant="outline"
              size="sm"
              disabled={loading}
              className="h-8 gap-1.5 border-neutral-200 text-xs font-medium hover:bg-neutral-100 dark:border-neutral-800 dark:hover:bg-neutral-900"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`}
              />
              Sync Data
            </Button>
          </div>
        )}
      </div>

      {/* Clean Horizontal Sub-Navigation Tabs */}
      <div className="flex scrollbar-none gap-1 overflow-x-auto border-b border-neutral-200 dark:border-neutral-800">
        {navItems.map((item) => {
          const active = isCurrent(item);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-xs font-medium whitespace-nowrap transition-colors ${
                active
                  ? 'border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400'
                  : 'border-transparent text-neutral-500 hover:border-neutral-300 hover:text-neutral-900 dark:text-neutral-400 dark:hover:border-neutral-700 dark:hover:text-neutral-200'
              }`}
            >
              <Icon
                className={`h-4 w-4 transition-colors ${
                  active
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-neutral-400 group-hover:text-neutral-600 dark:text-neutral-500 dark:group-hover:text-neutral-300'
                }`}
              />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
