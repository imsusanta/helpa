'use client';

import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { LeadStageType } from '@/core/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export interface LeadCardData {
  id: string;
  patientName: string;
  service: string;
  stage: LeadStageType;
  channel: 'whatsapp' | 'sms' | 'voice';
  score?: number;
  phone?: string;
  lastActivityAt: string;
}

const STAGES: { id: LeadStageType; label: string; color: string }[] = [
  { id: 'NEW', label: 'New Leads', color: 'bg-blue-500/10 text-blue-500' },
  {
    id: 'QUALIFYING',
    label: 'Qualifying',
    color: 'bg-amber-500/10 text-amber-500',
  },
  {
    id: 'QUALIFIED',
    label: 'Qualified',
    color: 'bg-emerald-500/10 text-emerald-500',
  },
  { id: 'BOOKED', label: 'Booked', color: 'bg-purple-500/10 text-purple-500' },
  {
    id: 'FOLLOW_UP',
    label: 'Follow-up',
    color: 'bg-orange-500/10 text-orange-500',
  },
  {
    id: 'CONVERTED',
    label: 'Converted',
    color: 'bg-teal-500/10 text-teal-500',
  },
  { id: 'LOST', label: 'Lost', color: 'bg-red-500/10 text-red-500' },
];

export function LeadKanbanBoard({
  initialLeads,
}: {
  initialLeads?: LeadCardData[];
}) {
  const [leads, setLeads] = useState<LeadCardData[]>(initialLeads || []);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor)
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const leadId = active.id as string;
    const newStage = over.id as LeadStageType;

    // Update optimistic lead stage
    setLeads((prev) =>
      prev.map((lead) =>
        lead.id === leadId ? { ...lead, stage: newStage } : lead
      )
    );

    toast.success(`Lead moved to ${newStage}`);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-foreground text-2xl font-bold">
            Omnichannel Lead Pipeline
          </h1>
          <p className="text-muted-foreground text-xs">
            Manage patient conversion across Voice, WhatsApp, and SMS.
          </p>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 gap-4 overflow-x-auto pb-4 md:grid-cols-4 lg:grid-cols-7">
          {STAGES.map((col) => {
            const stageLeads = leads.filter((l) => l.stage === col.id);
            return (
              <div
                key={col.id}
                className="bg-card border-border min-w-[220px] rounded-xl border p-3"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span
                    className={`rounded-md px-2 py-0.5 text-xs font-bold ${col.color}`}
                  >
                    {col.label}
                  </span>
                  <span className="text-muted-foreground text-xs font-bold">
                    {stageLeads.length}
                  </span>
                </div>

                <SortableContext
                  items={stageLeads.map((l) => l.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2.5">
                    {stageLeads.map((lead) => (
                      <Card
                        key={lead.id}
                        className="bg-background border-border/80 cursor-grab p-3 transition hover:shadow-md"
                      >
                        <CardHeader className="p-0 pb-1">
                          <CardTitle className="text-foreground text-sm font-bold">
                            {lead.patientName}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-1.5 p-0 text-xs">
                          <p className="text-muted-foreground font-medium">
                            {lead.service}
                          </p>
                          <div className="flex items-center justify-between pt-1">
                            <Badge
                              variant="outline"
                              className="text-[10px] capitalize"
                            >
                              {lead.channel}
                            </Badge>
                            <span className="text-muted-foreground text-[10px]">
                              {lead.lastActivityAt}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </SortableContext>
              </div>
            );
          })}
        </div>
      </DndContext>
    </div>
  );
}
