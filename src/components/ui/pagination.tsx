'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export interface PaginationProps extends React.HTMLAttributes<HTMLDivElement> {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems?: number;
  pageSize?: number;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  pageSize,
  className,
  ...props
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const startItem =
    totalItems && pageSize ? (currentPage - 1) * pageSize + 1 : null;
  const endItem =
    totalItems && pageSize
      ? Math.min(currentPage * pageSize, totalItems)
      : null;

  return (
    <div
      className={cn(
        'border-border/50 flex flex-col items-center justify-between gap-4 border-t px-2 py-3 text-sm sm:flex-row',
        className
      )}
      aria-label="Pagination Navigation"
      {...props}
    >
      {totalItems && startItem && endItem ? (
        <p className="text-muted-foreground text-xs">
          Showing{' '}
          <span className="text-foreground font-medium">{startItem}</span> to{' '}
          <span className="text-foreground font-medium">{endItem}</span> of{' '}
          <span className="text-foreground font-medium">{totalItems}</span>{' '}
          results
        </p>
      ) : (
        <p className="text-muted-foreground text-xs">
          Page{' '}
          <span className="text-foreground font-medium">{currentPage}</span> of{' '}
          <span className="text-foreground font-medium">{totalPages}</span>
        </p>
      )}

      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          aria-label="Previous Page"
          className="h-8 px-2.5"
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Previous
        </Button>

        <div className="flex items-center gap-1 px-1">
          {Array.from({ length: Math.min(5, totalPages) }).map((_, idx) => {
            const pageNum = idx + 1;
            const isActive = pageNum === currentPage;
            return (
              <Button
                key={pageNum}
                variant={isActive ? 'default' : 'ghost'}
                size="xs"
                onClick={() => onPageChange(pageNum)}
                aria-label={`Page ${pageNum}`}
                aria-current={isActive ? 'page' : undefined}
                className="h-7 w-7 p-0 text-xs"
              >
                {pageNum}
              </Button>
            );
          })}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          aria-label="Next Page"
          className="h-8 px-2.5"
        >
          Next
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
