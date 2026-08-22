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
import { salesApi } from '@/lib/sales/api-client';
import { SavedFilterBar } from '@/components/crm/saved-filter-bar';
import { useAuth } from '@/hooks/use-auth';
import {
  Users,
  Flame,
  Clock,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
} from 'lucide-react';

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
  const [activeFilterId, setActiveFilterId] = useState<string | null>(null);

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

  // Load real leads from Supabase API endpoint
  const loadRealLeads = useCallback(async () => {
    setLoading(true);
    try {
      const data = await salesApi<any[]>('/api/leads');
      if (Array.isArray(data)) {
        const mapped: LeadCardModel[] = data.map((d: any) => ({
          id: d.id || d.$id,
          patientName: d.name || d.contacts?.name || 'Lead Inquiry',
          phone: d.phone || d.contacts?.phone,
          service: d.service || 'General Inquiry',
          stage: (d.stage as LeadStageType) || 'NEW',
          channel: (d.channel as any) || 'whatsapp',
          score: d.score || d.lead_score || 'warm',
          value: d.value || 0,
          currency: d.currency || 'INR',
          assignedOwner: d.assigned_user_id
            ? { name: 'Assigned Agent' }
            : undefined,
          lastActivityAt:
            d.updated_at || d.created_at
              ? new Date(d.updated_at || d.created_at).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : 'Recent',
        }));
        setLeads(mapped);
      }
    } catch (err: unknown) {
      console.error('Failed to load leads from Supabase:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialLeads.length === 0) {
      loadRealLeads();
    }
  }, [initialLeads.length, loadRealLeads]);

  const { user } = useAuth();

  // Summary Metrics
  const totalLeadsCount = leads.length;
  const hotLeadsCount = useMemo(
    () =>
      leads.filter(
        (l) =>
          l.score === 'hot' || (typeof l.score === 'number' && l.score >= 70)
      ).length,
    [leads]
  );
  const newLeadsCount = useMemo(
    () => leads.filter((l) => l.stage === 'NEW').length,
    [leads]
  );
  const needsFollowupCount = useMemo(
    () =>
      leads.filter((l) => l.stage === 'FOLLOW_UP' || l.attentionRequired)
        .length,
    [leads]
  );

  // Real-data Attention Issues
  const attentionItems = useMemo(() => {
    const items: string[] = [];
    const hotNoFollowup = leads.filter(
      (l) =>
        (l.score === 'hot' || (typeof l.score === 'number' && l.score >= 70)) &&
        !l.nextAppointmentAt
    ).length;
    if (hotNoFollowup > 0) {
      items.push(
        `${hotNoFollowup} hot ${hotNoFollowup === 1 ? 'lead has' : 'leads have'} no follow-up scheduled`
      );
    }

    const uncontactedNew = leads.filter(
      (l) =>
        l.stage === 'NEW' &&
        (!l.lastActivityAt || l.lastActivityAt === 'Recent')
    ).length;
    if (uncontactedNew > 0) {
      items.push(
        `${uncontactedNew} new ${uncontactedNew === 1 ? 'lead has' : 'leads have'} not been contacted yet`
      );
    }

    const attentionReq = leads.filter((l) => l.attentionRequired).length;
    if (attentionReq > 0) {
      items.push(
        `${attentionReq} ${attentionReq === 1 ? 'lead requires' : 'leads require'} immediate attention`
      );
    }
    return items;
  }, [leads]);

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

      if (filters.score !== 'all') {
        const isHot =
          lead.score === 'hot' ||
          (typeof lead.score === 'number' && lead.score >= 70);
        const isWarm =
          lead.score === 'warm' ||
          (typeof lead.score === 'number' &&
            lead.score >= 40 &&
            lead.score < 70);
        const isCold =
          lead.score === 'cold' ||
          (typeof lead.score === 'number' && lead.score < 40);

        if (filters.score === 'hot' && !isHot) return false;
        if (filters.score === 'warm' && !isWarm) return false;
        if (filters.score === 'cold' && !isCold) return false;
      }

      if (
        filters.stage &&
        filters.stage !== 'all' &&
        lead.stage !== filters.stage
      ) {
        return false;
      }

      if (filters.assignment && filters.assignment !== 'everyone') {
        if (
          filters.assignment === 'me' &&
          lead.assignedOwner?.name !== user?.name
        ) {
          return false;
        }
        if (
          filters.assignment === 'unassigned' &&
          Boolean(lead.assignedOwner)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [leads, filters, user?.name]);

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
        await salesApi(`/api/leads/${leadId}/stage`, {
          method: 'POST',
          body: JSON.stringify({
            stage: targetStage,
            nextStage: targetStage,
            lost_reason: reason,
            reason,
          }),
        });

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
      assignment: 'everyone',
      stage: 'all',
    });
  }

  const activeLead = activeLeadId
    ? leads.find((l) => l.id === activeLeadId) || null
    : null;

  return (
    <div className="space-y-5">
      {/* Overview Metrics Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="bg-card border-border rounded-xl border p-3.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs font-medium">
              Total Leads
            </span>
            <Users className="text-primary size-4" />
          </div>
          <p className="text-foreground mt-1 text-2xl font-bold">
            {totalLeadsCount}
          </p>
        </div>
        <div className="bg-card border-border rounded-xl border p-3.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs font-medium">
              Hot Leads
            </span>
            <Flame className="size-4 text-red-500" />
          </div>
          <p className="text-foreground mt-1 text-2xl font-bold">
            {hotLeadsCount}
          </p>
        </div>
        <div className="bg-card border-border rounded-xl border p-3.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs font-medium">
              New Leads
            </span>
            <TrendingUp className="size-4 text-blue-500" />
          </div>
          <p className="text-foreground mt-1 text-2xl font-bold">
            {newLeadsCount}
          </p>
        </div>
        <div className="bg-card border-border rounded-xl border p-3.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs font-medium">
              Needs Follow-up
            </span>
            <Clock className="size-4 text-amber-500" />
          </div>
          <p className="text-foreground mt-1 text-2xl font-bold">
            {needsFollowupCount}
          </p>
        </div>
      </div>

      {/* Needs Your Attention Section */}
      {attentionItems.length > 0 ? (
        <div className="space-y-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 shadow-2xs">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-600 dark:text-amber-400">
            <AlertTriangle className="size-4" />
            <span>Needs Your Attention</span>
          </div>
          <ul className="text-foreground/90 list-inside list-disc space-y-1 text-xs">
            {attentionItems.map((item, idx) => (
              <li key={idx} className="font-medium">
                {item}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs font-medium text-emerald-600 shadow-2xs dark:text-emerald-400">
          <CheckCircle2 className="size-4" />
          <span>✓ Everything is up to date</span>
        </div>
      )}

      <LeadBoardToolbar
        filters={filters}
        onFilterChange={handleFilterChange}
        onClearFilters={handleClearFilters}
        onRefresh={loadRealLeads}
        isLoading={loading}
        totalLeadsCount={leads.length}
        filteredLeadsCount={filteredLeads.length}
      />

      <SavedFilterBar
        entityType="leads"
        currentFilters={filters as unknown as Record<string, unknown>}
        activeFilterId={activeFilterId}
        onSelectFilter={(filterId, savedFilters) => {
          setActiveFilterId(filterId);
          if (savedFilters) {
            setFilters((prev) => ({
              ...prev,
              ...(savedFilters as unknown as LeadFilterState),
            }));
          } else if (filterId === null) {
            handleClearFilters();
          }
        }}
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
