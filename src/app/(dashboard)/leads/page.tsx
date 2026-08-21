import { Suspense } from 'react';
import { LeadKanbanBoard } from '@/components/kanban/lead-kanban-board';

export default function LeadsKanbanPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-foreground text-2xl font-bold">Leads</h1>
          <p className="text-muted-foreground text-sm">
            Track prospects, manage inquiries and move opportunities forward.
          </p>
        </div>
      </div>

      <Suspense
        fallback={
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4 lg:grid-cols-7">
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div
                key={i}
                className="bg-card/50 h-96 animate-pulse rounded-xl"
              />
            ))}
          </div>
        }
      >
        <LeadKanbanBoard />
      </Suspense>
    </div>
  );
}
