'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

export interface LoadingStateProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'spinner' | 'table' | 'card' | 'list';
  text?: string;
  rows?: number;
}

export function LoadingState({
  variant = 'spinner',
  text = 'Loading...',
  rows = 4,
  className,
  ...props
}: LoadingStateProps) {
  if (variant === 'table') {
    return (
      <div className={cn('w-full space-y-3 p-4', className)} {...props}>
        <div className="border-border flex items-center justify-between gap-4 border-b pb-2">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-8 w-24 rounded-md" />
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center justify-between gap-4 py-2">
            <Skeleton className="h-5 w-1/4" />
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-5 w-1/6" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <div
        className={cn(
          'grid grid-cols-1 gap-4 p-4 md:grid-cols-2 lg:grid-cols-3',
          className
        )}
        {...props}
      >
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="border-border bg-card/50 space-y-3 rounded-xl border p-5"
          >
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'list') {
    return (
      <div className={cn('space-y-2.5 p-2', className)} {...props}>
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="bg-card/40 flex items-center gap-3 rounded-lg p-3"
          >
            <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'text-muted-foreground flex min-h-[160px] flex-col items-center justify-center p-8 text-center',
        className
      )}
      {...props}
    >
      <Loader2 className="text-primary mb-2 h-6 w-6 animate-spin" />
      {text && <p className="text-sm font-medium">{text}</p>}
    </div>
  );
}
