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
import { cn } from '@/lib/utils';

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
    <div className="space-y-4 pb-1">
      {/* Super Admin Top Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-xl">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-foreground text-xl font-bold tracking-tight sm:text-2xl">
                Super Admin
              </h1>
              <span className="border-primary/20 bg-primary/10 text-primary inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold">
                <Sparkles className="h-3 w-3" /> Platform Control
              </span>
            </div>
            <p className="text-muted-foreground text-xs">
              Platform governance, subscriber accounts, pricing plans, and AI
              engine setup.
            </p>
          </div>
        </div>

        {onRefresh && (
          <div className="flex items-center gap-2">
            <Button
              onClick={onRefresh}
              variant="outline"
              size="sm"
              disabled={loading}
              className="border-border/80 hover:bg-muted/80 h-8 gap-1.5 rounded-lg text-xs font-medium"
            >
              <RefreshCw
                className={cn('h-3.5 w-3.5', loading && 'animate-spin')}
              />
              Sync Data
            </Button>
          </div>
        )}
      </div>

      {/* Clean Minimal Pill Navigation */}
      <div className="border-border/60 bg-muted/40 flex scrollbar-none items-center gap-1 overflow-x-auto rounded-xl border p-1">
        {navItems.map((item) => {
          const active = isCurrent(item);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-medium whitespace-nowrap transition-all duration-150',
                active
                  ? 'bg-background text-foreground font-semibold shadow-xs'
                  : 'text-muted-foreground hover:bg-background/50 hover:text-foreground'
              )}
            >
              <Icon
                className={cn(
                  'h-3.5 w-3.5 transition-colors',
                  active ? 'text-primary' : 'text-muted-foreground'
                )}
              />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
