'use client';

import { useDroppable } from '@dnd-kit/core';
import { LeadStageType } from '@/core/types';
import { LeadCardModel, LeadKanbanCard } from './lead-kanban-card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { MoveRight } from 'lucide-react';

export interface StageColumnDef {
  id: LeadStageType;
  label: string;
  color: string;
}

interface LeadKanbanColumnProps {
  column: StageColumnDef;
  leads: LeadCardModel[];
  allStages: StageColumnDef[];
  onCardClick: (lead: LeadCardModel) => void;
  onMoveLeadStage: (leadId: string, targetStage: LeadStageType) => void;
}

export function LeadKanbanColumn({
  column,
  leads,
  allStages,
  onCardClick,
  onMoveLeadStage,
}: LeadKanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <div className="bg-card/70 border-border flex w-[85vw] max-w-[320px] min-w-[260px] shrink-0 snap-start flex-col rounded-xl border p-3.5 shadow-2xs lg:w-auto lg:max-w-none lg:flex-1 lg:shrink lg:basis-[260px] lg:snap-none">
      {/* 3px Colored Top Accent Border */}
      <div
        className="-mx-3.5 -mt-3.5 h-[3px] rounded-t-xl"
        style={{ backgroundColor: column.color }}
      />

      {/* Sticky Column Header */}
      <div className="bg-card/90 sticky top-0 z-10 pt-3 pb-2 backdrop-blur-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 truncate">
            <h3 className="text-foreground truncate text-xs font-bold tracking-wider uppercase">
              {column.label}
            </h3>
          </div>
          <span className="bg-muted text-muted-foreground shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold">
            {leads.length}
          </span>
        </div>
      </div>

      {/* Droppable Drop Zone Container */}
      <div
        ref={setNodeRef}
        className={`mt-2 flex flex-1 flex-col gap-2.5 rounded-lg p-1 transition-all ${
          isOver
            ? 'bg-primary/5 outline-primary outline outline-2 outline-offset-2 outline-dashed'
            : ''
        }`}
      >
        {leads.length === 0 ? (
          <div className="border-border text-muted-foreground/60 flex flex-1 items-center justify-center rounded-lg border border-dashed py-12 text-xs font-medium">
            No leads in stage
          </div>
        ) : (
          leads.map((lead) => (
            <div key={lead.id} className="group/card relative">
              <LeadKanbanCard lead={lead} onClick={onCardClick} />

              {/* Accessible Keyboard Stage Movement Action */}
              <div className="absolute top-2 right-2 z-20 opacity-0 transition-opacity group-hover/card:opacity-100 focus-within:opacity-100">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="secondary"
                        size="icon-xs"
                        className="h-6 w-6 rounded-md shadow-2xs"
                        title="Move stage"
                      >
                        <MoveRight className="h-3 w-3" />
                        <span className="sr-only">
                          Move {lead.patientName} stage
                        </span>
                      </Button>
                    }
                  />
                  <DropdownMenuContent align="end" className="w-44 text-xs">
                    {allStages
                      .filter((s) => s.id !== column.id)
                      .map((stg) => (
                        <DropdownMenuItem
                          key={stg.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            onMoveLeadStage(lead.id, stg.id);
                          }}
                          className="text-xs"
                        >
                          Move to {stg.label}
                        </DropdownMenuItem>
                      ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
