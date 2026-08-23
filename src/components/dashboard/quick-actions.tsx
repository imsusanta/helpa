'use client';

import Link from 'next/link';
import { UserPlus, Briefcase, Radio, Zap } from 'lucide-react';
import type { ComponentType } from 'react';
import { useWorkspace } from '@/hooks/use-workspace';

// Quick-action shortcuts. Each navigates to the page that owns the
// relevant "create" flow. We deliberately don't try to auto-open any
// modal on the target page — that'd require touching those pages,
// which is out of scope here.
interface Action {
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  tint: string;
}

const STATIC_ACTIONS: Action[] = [
  {
    label: 'New Broadcast',
    href: '/broadcasts/new',
    icon: Radio,
    tint: 'text-amber-400',
  },
  {
    label: 'New Automation',
    href: '/automations/new',
    icon: Zap,
    tint: 'text-primary',
  },
];

export function QuickActions() {
  const { terminology } = useWorkspace();
  const actions: Action[] = [
    {
      label: `New ${terminology.person}`,
      href: '/contacts',
      icon: UserPlus,
      tint: 'text-primary',
    },
    {
      label: `New ${terminology.pipelineItem}`,
      href: '/pipelines',
      icon: Briefcase,
      tint: 'text-blue-400',
    },
    ...STATIC_ACTIONS,
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {actions.map((a) => {
        const Icon = a.icon;
        return (
          <Link
            key={a.href}
            href={a.href}
            className="group border-border bg-card hover:border-border hover:bg-muted/60 flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors"
          >
            <div
              className={`bg-muted flex h-9 w-9 items-center justify-center rounded-lg ${a.tint}`}
            >
              <Icon className="h-4 w-4" />
            </div>
            <span className="text-foreground text-sm font-medium">
              {a.label}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
