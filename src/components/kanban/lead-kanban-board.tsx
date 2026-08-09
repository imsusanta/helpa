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
import { createClient } from '@/lib/supabase/client';

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

  // Load real leads from Supabase if initialLeads is empty
  const loadRealLeads = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('deals')
        .select(
          '*, contact:contacts(*), assignee:profiles!deals_assigned_to_fkey(*)'
        )
        .order('updated_at', { ascending: false });

      if (error) throw error;

      if (data) {
        const mapped: LeadCardModel[] = data.map((d) => ({
          id: d.id,
          patientName: d.contact?.name || d.title || 'Patient Inquiry',
          phone: d.contact?.phone,
          service: d.ai_product_service || d.title || 'General OPD',
          stage: (d.stage as LeadStageType) || 'NEW',
          channel:
            (d.contact?.metadata?.channel as 'whatsapp' | 'sms' | 'voice') ||
            'whatsapp',
          score: (d.ai_lead_score as 'hot' | 'warm' | 'cold') || 'warm',
          assignedOwner: d.assignee
            ? { name: d.assignee.full_name, avatarUrl: d.assignee.avatar_url }
            : undefined,
          lastActivityAt: d.updated_at
            ? new Date(d.updated_at).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })
            : 'Recent',
          nextAppointmentAt: d.expected_close_date || undefined,
        }));
        setLeads(mapped);
      }
    } catch (err: unknown) {
      console.error('Failed to load leads:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialLeads.length === 0) {
      loadRealLeads();
    }
  }, [initialLeads.length, loadRealLeads]);

  // DND Sensors (5px distance constraint to avoid accidental clicks)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  // Filter & Search Logic
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      // Search query filter (patient name, phone, service)
      if (filters.search.trim()) {
        const q = filters.search.toLowerCase().trim();
        const matchesName = lead.patientName.toLowerCase().includes(q);
        const matchesPhone = lead.phone?.toLowerCase().includes(q);
        const matchesService = lead.service.toLowerCase().includes(q);
        if (!matchesName && !matchesPhone && !matchesService) return false;
      }

      // Channel filter
      if (filters.channel !== 'all' && lead.channel !== filters.channel) {
        return false;
      }

      // Service filter
      if (
        filters.service !== 'all' &&
        !lead.service.toLowerCase().includes(filters.service.toLowerCase())
      ) {
        return false;
      }

      // Score filter
      if (filters.score !== 'all' && lead.score !== filters.score) {
        return false;
      }

      return true;
    });
  }, [leads, filters]);

  // Handlers for URL State & Drawer
  const handleCardClick = useCallback(
    (lead: LeadCardModel) => {
      setSelectedLeadId(lead.id);
      setDrawerOpen(true);

      // Push ?leadId=... to URL
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

  // Secure Stage Transition Boundary Call
  const handleMoveLeadStage = useCallback(
    async (leadId: string, targetStage: LeadStageType): Promise<boolean> => {
      const originalLead = leads.find((l) => l.id === leadId);
      if (!originalLead || originalLead.stage === targetStage) return true;

      // 1. Optimistic Update
      setLeads((prev) =>
        prev.map((l) => (l.id === leadId ? { ...l, stage: targetStage } : l))
      );

      try {
        // 2. Secure Server Call
        const res = await fetch(`/api/leads/${leadId}/stage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nextStage: targetStage }),
        });

        const json = await res.json();

        if (!res.ok || !json.success) {
          // 3. Rollback on failure
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

  // Drag & Drop Handlers
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
      {/* Board Toolbar */}
      <LeadBoardToolbar
        filters={filters}
        onFilterChange={handleFilterChange}
        onClearFilters={handleClearFilters}
        onRefresh={loadRealLeads}
        isLoading={loading}
        totalLeadsCount={leads.length}
        filteredLeadsCount={filteredLeads.length}
      />

      {/* DndContext & Horizontal Scrolling Columns Grid */}
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

      {/* Lead Details Side Drawer */}
      <LeadDetailsDrawer
        leadId={selectedLeadId}
        open={drawerOpen}
        onOpenChange={handleDrawerClose}
        onStageChange={handleMoveLeadStage}
      />
    </div>
  );
}
