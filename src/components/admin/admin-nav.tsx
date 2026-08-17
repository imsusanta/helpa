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
    <div className="space-y-6">
      {/* Clean Minimal Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            <h1 className="text-foreground text-2xl font-semibold tracking-tight">
              Super Admin
            </h1>
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            Platform governance, multi-tenant diagnostics, billing tiers, and AI
            configuration.
          </p>
        </div>
        {onRefresh && (
          <div className="flex items-center gap-2">
            <Button
              onClick={onRefresh}
              variant="outline"
              size="sm"
              disabled={loading}
              className="h-8 gap-1.5 text-xs font-medium"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`}
              />
              Sync Data
            </Button>
          </div>
        )}
      </div>

      {/* Clean Tab Navigation */}
      <div className="border-border flex gap-2 border-b">
        {navItems.map((item) => {
          const active = isCurrent(item);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-xs font-medium whitespace-nowrap transition-colors ${
                active
                  ? 'border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400'
                  : 'text-muted-foreground hover:text-foreground border-transparent'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
