/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  DragEndEvent,
  DragStartEvent,
} from '@dnd-kit/core';
import { LeadStageType } from '@/core/types';
import { LeadBoardToolbar, LeadFilterState } from './lead-board-toolbar';
import { LeadKanbanColumn, StageColumnDef } from './lead-kanban-column';
import { LeadCardModel, LeadKanbanCard } from './lead-kanban-card';
import { LeadDetailsDrawer } from './lead-details-drawer';
import { toast } from 'sonner';
import { getAppwriteClient } from '@/infrastructure/appwrite/client';
import { APPWRITE_CONFIG } from '@/infrastructure/appwrite/config';

export const CANONICAL_STAGES: StageColumnDef[] = [
  { id: 'NEW', label: 'New Leads', color: '#3b82f6' },
  { id: 'QUALIFYING', label: 'Qualifying', color: '#f59e0b' },
  { id: 'QUALIFIED', label: 'Qualified', color: '#10b981' },
  { id: 'BOOKED', label: 'Booked', color: '#8b5cf6' },
  { id: 'FOLLOW_UP', label: 'Follow-up', color: '#f97316' },
  { id: 'CONVERTED', label: 'Converted', color: '#14b8a6' },
  { id: 'LOST', label: 'Lost', color: '#ef4444' },
];

export function LeadKanbanBoard({
  initialLeads = [],
}: {
  initialLeads?: LeadCardModel[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [leads, setLeads] = useState<LeadCardModel[]>(initialLeads);
  const [loading, setLoading] = useState(false);
  const [activeLeadId, setActiveLeadId] = useState<string | null>(null);

  // Filters State
  const [filters, setFilters] = useState<LeadFilterState>({
    search: '',
    channel: 'all',
    service: 'all',
    score: 'all',
  });

  // Selected Lead for Details Drawer (Synced with URL ?leadId=...)
  const selectedLeadIdFromUrl = searchParams.get('leadId');
  const [drawerOpen, setDrawerOpen] = useState(Boolean(selectedLeadIdFromUrl));
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(
    selectedLeadIdFromUrl
  );

  // Keep drawer open & selectedLeadId in sync with URL ?leadId=
  useEffect(() => {
    const urlId = searchParams.get('leadId');
    if (urlId) {
      setSelectedLeadId(urlId);
      setDrawerOpen(true);
    }
  }, [searchParams]);

  // Load real leads from Appwrite API endpoint
  const loadRealLeads = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/leads');
      const json = await res.json();

      if (json.success && Array.isArray(json.data)) {
        const mapped: LeadCardModel[] = json.data.map((d: any) => ({
          id: d.$id || d.id,
          patientName: d.name || 'Patient Inquiry',
          phone: d.phone,
          service: d.service || 'General OPD',
          stage: (d.stage as LeadStageType) || 'NEW',
          channel: 'whatsapp',
          score: 'warm',
          assignedOwner: d.assignedAgentId
            ? { name: d.assignedAgentId }
            : undefined,
          lastActivityAt: d.updatedAt
            ? new Date(d.updatedAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })
            : 'Recent',
        }));
        setLeads(mapped);
      }
    } catch (err: unknown) {
      console.error('Failed to load leads from Appwrite:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialLeads.length === 0) {
      loadRealLeads();
    }

    let unsubscribe: (() => void) | undefined;

    try {
      const { client } = getAppwriteClient();
      const channel = `databases.${APPWRITE_CONFIG.databaseId}.collections.${APPWRITE_CONFIG.collections.leads}.documents`;
      unsubscribe = client.subscribe([channel], () => {
        loadRealLeads();
      });
    } catch {
      // ignore
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [initialLeads.length, loadRealLeads]);

  // DND Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  // Filter & Search Logic
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      if (filters.search.trim()) {
        const q = filters.search.toLowerCase().trim();
        const matchesName = lead.patientName.toLowerCase().includes(q);
        const matchesPhone = lead.phone?.toLowerCase().includes(q);
        const matchesService = lead.service.toLowerCase().includes(q);
        if (!matchesName && !matchesPhone && !matchesService) return false;
      }

      if (filters.channel !== 'all' && lead.channel !== filters.channel) {
        return false;
      }

      if (
        filters.service !== 'all' &&
        !lead.service.toLowerCase().includes(filters.service.toLowerCase())
      ) {
        return false;
      }

      if (filters.score !== 'all' && lead.score !== filters.score) {
        return false;
      }

      return true;
    });
  }, [leads, filters]);

  const handleCardClick = useCallback(
    (lead: LeadCardModel) => {
      setSelectedLeadId(lead.id);
      setDrawerOpen(true);

      const params = new URLSearchParams(searchParams.toString());
      params.set('leadId', lead.id);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const handleDrawerClose = useCallback(
    (open: boolean) => {
      setDrawerOpen(open);
      if (!open) {
        setSelectedLeadId(null);
        const params = new URLSearchParams(searchParams.toString());
        params.delete('leadId');
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      }
    },
    [pathname, router, searchParams]
  );

  const handleMoveLeadStage = useCallback(
    async (
      leadId: string,
      targetStage: LeadStageType,
      customReason?: string
    ): Promise<boolean> => {
      const originalLead = leads.find((l) => l.id === leadId);
      if (!originalLead || originalLead.stage === targetStage) return true;

      let reason = customReason;
      if (targetStage === 'LOST' && !reason) {
        const userPrompt = window.prompt(
          'Please provide a reason for marking this lead as LOST:'
        );
        if (userPrompt === null) {
          return false;
        }
        reason = userPrompt.trim() || 'Marked lost from Kanban board';
      }

      // Optimistic update
      setLeads((prev) =>
        prev.map((l) => (l.id === leadId ? { ...l, stage: targetStage } : l))
      );

      try {
        const res = await fetch(`/api/leads/${leadId}/stage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nextStage: targetStage, reason }),
        });

        const json = await res.json();

        if (!res.ok || !json.success) {
          // Rollback on failure
          setLeads((prev) =>
            prev.map((l) =>
              l.id === leadId ? { ...l, stage: originalLead.stage } : l
            )
          );
          toast.error(json.error || 'Failed to update lead stage.');
          return false;
        }

        toast.success(`Stage updated to ${targetStage}`);
        return true;
      } catch (err: unknown) {
        // Rollback on network error
        setLeads((prev) =>
          prev.map((l) =>
            l.id === leadId ? { ...l, stage: originalLead.stage } : l
          )
        );
        toast.error((err as Error).message || 'Network error updating stage.');
        return false;
      }
    },
    [leads]
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveLeadId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveLeadId(null);
    const { active, over } = event;
    if (!over) return;

    const leadId = String(active.id);
    const targetStage = String(over.id) as LeadStageType;

    if (CANONICAL_STAGES.some((s) => s.id === targetStage)) {
      handleMoveLeadStage(leadId, targetStage);
    }
  }

  function handleFilterChange(key: keyof LeadFilterState, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function handleClearFilters() {
    setFilters({
      search: '',
      channel: 'all',
      service: 'all',
      score: 'all',
    });
  }

  const activeLead = activeLeadId
    ? leads.find((l) => l.id === activeLeadId) || null
    : null;

  return (
    <div className="space-y-5">
      <LeadBoardToolbar
        filters={filters}
        onFilterChange={handleFilterChange}
        onClearFilters={handleClearFilters}
        onRefresh={loadRealLeads}
        isLoading={loading}
        totalLeadsCount={leads.length}
        filteredLeadsCount={filteredLeads.length}
      />

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveLeadId(null)}
      >
        <div className="pipeline-scroll flex snap-x snap-mandatory gap-3.5 overflow-x-auto pb-4 lg:snap-none">
          {CANONICAL_STAGES.map((col) => {
            const stageLeads = filteredLeads.filter((l) => l.stage === col.id);
            return (
              <LeadKanbanColumn
                key={col.id}
                column={col}
                leads={stageLeads}
                allStages={CANONICAL_STAGES}
                onCardClick={handleCardClick}
                onMoveLeadStage={handleMoveLeadStage}
              />
            );
          })}
        </div>

        <DragOverlay
          dropAnimation={{
            duration: 200,
            easing: 'cubic-bezier(0.2, 0, 0, 1)',
          }}
        >
          {activeLead ? (
            <LeadKanbanCard lead={activeLead} onClick={() => {}} isOverlay />
          ) : null}
        </DragOverlay>
      </DndContext>

      <LeadDetailsDrawer
        leadId={selectedLeadId}
        open={drawerOpen}
        onOpenChange={handleDrawerClose}
        onStageChange={handleMoveLeadStage}
      />
    </div>
  );
}
