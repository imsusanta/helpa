'use client';

import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * Shared page header for the Automation & AI module surfaces (Chatbot,
 * FAQ Bot, AI Assistant). Presentational only — the icon, title and
 * description are supplied per page.
 */
export function ModuleHeader({
  icon: Icon,
  title,
  description,
  badge,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  badge?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between',
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-foreground text-xl font-semibold tracking-tight">
              {title}
            </h1>
            {badge}
          </div>
          {description ? (
            <p className="text-muted-foreground mt-1 max-w-[68ch] text-sm">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
