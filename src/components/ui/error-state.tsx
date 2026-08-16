'use client';

import * as React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export interface ErrorStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export function ErrorState({
  title = 'Something went wrong',
  message = 'An error occurred while fetching data. Please check your network connection or try again.',
  onRetry,
  retryLabel = 'Try Again',
  className,
  ...props
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        'border-destructive/20 bg-destructive/5 text-destructive-foreground my-4 flex flex-col items-center justify-center rounded-xl border p-6 text-center',
        className
      )}
      {...props}
    >
      <div className="bg-destructive/10 text-destructive mb-3 flex h-12 w-12 items-center justify-center rounded-full">
        <AlertTriangle className="h-6 w-6 shrink-0" aria-hidden="true" />
      </div>
      <h4 className="text-foreground mb-1 text-base font-semibold tracking-tight">
        {title}
      </h4>
      <p className="text-muted-foreground mb-5 max-w-md text-sm leading-relaxed">
        {message}
      </p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="gap-2">
          <RefreshCw className="h-3.5 w-3.5" />
          {retryLabel}
        </Button>
      )}
    </div>
  );
}
