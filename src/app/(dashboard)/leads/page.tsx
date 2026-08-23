'use client';

import { Suspense } from 'react';
import { LeadKanbanBoard } from '@/components/kanban/lead-kanban-board';
import { useWorkspace } from '@/hooks/use-workspace';

export default function LeadsKanbanPage() {
  const { terminology } = useWorkspace();
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-foreground text-2xl font-bold">
            {terminology.pipelineItems}
          </h1>
          <p className="text-muted-foreground text-sm">
            Track {terminology.pipelineItems.toLowerCase()}, manage enquiries
            and move each record through its next stage.
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
