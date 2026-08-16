'use client';

import * as React from 'react';
import { LucideIcon, Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'border-border bg-card/40 text-card-foreground my-4 flex flex-col items-center justify-center rounded-xl border border-dashed p-8 text-center transition-all',
        className
      )}
      {...props}
    >
      <div className="bg-muted/60 text-muted-foreground mb-4 flex h-12 w-12 items-center justify-center rounded-full">
        <Icon className="h-6 w-6 shrink-0" aria-hidden="true" />
      </div>
      <h3 className="text-foreground mb-1 text-base font-semibold tracking-tight">
        {title}
      </h3>
      {description && (
        <p className="text-muted-foreground mb-6 max-w-sm text-sm leading-relaxed">
          {description}
        </p>
      )}
      {(actionLabel || secondaryActionLabel) && (
        <div className="flex flex-wrap items-center justify-center gap-3">
          {secondaryActionLabel && onSecondaryAction && (
            <Button variant="outline" size="sm" onClick={onSecondaryAction}>
              {secondaryActionLabel}
            </Button>
          )}
          {actionLabel && onAction && (
            <Button variant="default" size="sm" onClick={onAction}>
              {actionLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
