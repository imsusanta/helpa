'use client';

import type { LucideIcon } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/**
 * A single metric tile for the Automation & AI overview. Values are supplied
 * by the caller from real backend data (see {@link useAiStats}); this
 * component is purely presentational and never invents numbers.
 */
export function AiStatCard({
  icon: Icon,
  label,
  value,
  sublabel,
  loading = false,
  accent = 'emerald',
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  sublabel?: string;
  loading?: boolean;
  accent?: 'emerald' | 'blue' | 'violet' | 'amber';
}) {
  const accentClass = {
    emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40',
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40',
    violet: 'bg-violet-50 text-violet-600 dark:bg-violet-950/40',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40',
  }[accent];

  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg',
            accentClass
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-muted-foreground truncate text-xs font-medium">
            {label}
          </p>
          {loading ? (
            <Skeleton className="mt-1 h-6 w-16" />
          ) : (
            <p className="text-foreground text-xl font-semibold tabular-nums">
              {value}
            </p>
          )}
          {sublabel ? (
            <p className="text-muted-foreground mt-0.5 truncate text-xs">
              {sublabel}
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
