'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Zap,
  Plus,
  MoreVertical,
  Copy,
  Pencil,
  Trash2,
  FileText,
  MessageCircle,
  Clock,
  Users,
  PhoneCall,
  Loader2,
  CalendarDays,
  UserPlus,
  GraduationCap,
  Building2,
  BookOpen,
  UtensilsCrossed,
} from 'lucide-react';

import { useCan } from '@/hooks/use-can';
import type { Automation } from '@/types';
import { Button } from '@/components/ui/button';
import { GatedButton } from '@/components/ui/gated-button';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AUTOMATION_TEMPLATES,
  type TemplateSlug,
} from '@/lib/automations/templates';
import { triggerMeta, formatRelative } from '@/lib/automations/trigger-meta';
import { cn } from '@/lib/utils';

const TEMPLATE_ORDER: TemplateSlug[] = [
  'welcome_message',
  'out_of_office',
  'lead_qualifier',
  'follow_up_reminder',
  'doctor_booking_enquiry',
  'new_lead_instant_reply',
  'admission_enquiry',
  'property_site_visit',
  'course_enquiry',
  'table_booking',
];

const TEMPLATE_ICON: Record<TemplateSlug, typeof Zap> = {
  welcome_message: MessageCircle,
  out_of_office: Clock,
  lead_qualifier: Users,
  follow_up_reminder: PhoneCall,
  doctor_booking_enquiry: CalendarDays,
  new_lead_instant_reply: UserPlus,
  admission_enquiry: GraduationCap,
  property_site_visit: Building2,
  course_enquiry: BookOpen,
  table_booking: UtensilsCrossed,
};

export default function AutomationsPage() {
  const router = useRouter();
  const canCreate = useCan('send-messages');
  const [automations, setAutomations] = useState<Automation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Automation | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    try {
      setError(null);
      const response = await fetch('/api/automations', {
        credentials: 'include',
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          payload?.message || payload?.error || 'Failed to load automations'
        );
      }
      setAutomations((payload?.automations ?? []) as Automation[]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load automations'
      );
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function toggleActive(a: Automation, next: boolean) {
    // Optimistic flip so the switch feels instant.
    setAutomations(
      (prev) =>
        prev?.map((x) => (x.id === a.id ? { ...x, is_active: next } : x)) ??
        prev
    );
    const res = await fetch(`/api/automations/${a.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ is_active: next }),
    });
    if (!res.ok) {
      // Roll back on error.
      setAutomations(
        (prev) =>
          prev?.map((x) => (x.id === a.id ? { ...x, is_active: !next } : x)) ??
          prev
      );
      const body = await res.json().catch(() => ({}));
      toast.error(body?.error ?? 'Failed to update');
      return;
    }
    toast.success(next ? 'Automation activated' : 'Automation paused');
  }

  async function duplicate(a: Automation) {
    const res = await fetch(`/api/automations/${a.id}/duplicate`, {
      method: 'POST',
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body?.error ?? 'Failed to duplicate');
      return;
    }
    toast.success('Automation duplicated');
    load();
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    const res = await fetch(`/api/automations/${pendingDelete.id}`, {
      method: 'DELETE',
    });
    setDeleting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body?.error ?? 'Failed to delete');
      return;
    }
    toast.success('Automation deleted');
    setPendingDelete(null);
    load();
  }

  async function startFromTemplate(slug: TemplateSlug) {
    router.push(`/automations/new?template=${slug}`);
  }

  if (error) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2">
        <p className="text-sm text-red-400">{error}</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  if (automations === null) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="text-primary h-6 w-6 animate-spin" />
      </div>
    );
  }

  const showTemplates = automations.length < 3;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-foreground text-2xl font-bold">
            Auto-Reminders & Follow-ups
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Set up automatic WhatsApp messages, appointment reminders, and
            customer follow-up rules.
          </p>
        </div>
        <GatedButton
          canAct={canCreate}
          gateReason="create automations"
          onClick={() => router.push('/automations/new')}
          className="bg-emerald-600 text-xs font-bold text-white hover:bg-emerald-700"
        >
          <Plus className="mr-1.5 h-4 w-4" />
          Custom Automation
        </GatedButton>
      </div>

      {showTemplates && (
        <section>
          <h2 className="text-muted-foreground mb-3 text-xs font-semibold tracking-wider uppercase">
            Recommended for your business
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {TEMPLATE_ORDER.map((slug) => {
              const t = AUTOMATION_TEMPLATES[slug];
              const Icon = TEMPLATE_ICON[slug];
              return (
                <button
                  key={slug}
                  onClick={() => startFromTemplate(slug)}
                  className="group border-border bg-card hover:bg-card/80 flex flex-col items-start rounded-xl border p-4 text-left transition-colors hover:border-emerald-500/50"
                >
                  <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500 group-hover:bg-emerald-500/20">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="text-foreground text-sm font-semibold">
                    {t.name}
                  </div>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {t.description}
                  </p>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {automations.length === 0 ? (
        <div className="border-border bg-card/40 flex h-48 flex-col items-center justify-center rounded-xl border border-dashed p-6 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
            <Zap className="h-6 w-6" />
          </div>
          <p className="text-foreground text-sm font-bold">
            Let Helpa handle repetitive follow-ups
          </p>
          <p className="text-muted-foreground mt-1 max-w-md text-xs">
            Choose a ready-made reminder or follow-up for your business above.
            You can turn it on in one click.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {automations.map((a) => (
            <AutomationCard
              key={a.id}
              automation={a}
              onToggle={(next) => toggleActive(a, next)}
              onEdit={() => router.push(`/automations/${a.id}/edit`)}
              onDuplicate={() => duplicate(a)}
              onLogs={() => router.push(`/automations/${a.id}/logs`)}
              onDelete={() => setPendingDelete(a)}
            />
          ))}
        </ul>
      )}

      <Dialog
        open={!!pendingDelete}
        onOpenChange={(v) => !v && setPendingDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete automation</DialogTitle>
            <DialogDescription>
              This permanently removes{' '}
              <span className="text-foreground">{pendingDelete?.name}</span> and
              its execution history. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setPendingDelete(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleting}
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AutomationCard({
  automation,
  onToggle,
  onEdit,
  onDuplicate,
  onLogs,
  onDelete,
}: {
  automation: Automation;
  onToggle: (next: boolean) => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onLogs: () => void;
  onDelete: () => void;
}) {
  const meta = triggerMeta(automation.trigger_type);
  return (
    <li className="border-border bg-card hover:border-border rounded-xl border transition-colors">
      <div className="flex items-center gap-4 p-4">
        <div
          className="bg-primary/10 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg"
          aria-hidden
        >
          <Zap className="text-primary h-5 w-5" />
        </div>

        <button
          type="button"
          onClick={onEdit}
          className="min-w-0 flex-1 text-left"
        >
          <div className="flex items-center gap-2">
            <span className="text-foreground truncate text-sm font-semibold">
              {automation.name}
            </span>
            {automation.is_active && (
              <span className="relative flex h-2 w-2" aria-label="active">
                <span className="bg-primary absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" />
                <span className="bg-primary relative inline-flex h-2 w-2 rounded-full" />
              </span>
            )}
          </div>
          {automation.description && (
            <p className="text-muted-foreground mt-0.5 truncate text-xs">
              {automation.description}
            </p>
          )}
          <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span
              className={cn(
                'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium',
                meta.pillClass
              )}
            >
              {meta.label}
            </span>
            <span className="tabular-nums">
              {automation.execution_count} run
              {automation.execution_count === 1 ? '' : 's'}
            </span>
            <span aria-hidden>·</span>
            <span>last {formatRelative(automation.last_executed_at)}</span>
          </div>
        </button>

        <div className="flex items-center gap-3">
          <Switch
            checked={automation.is_active}
            onCheckedChange={(v) => onToggle(!!v)}
            aria-label={automation.is_active ? 'Deactivate' : 'Activate'}
          />

          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Open menu"
              className="text-muted-foreground hover:bg-muted hover:text-foreground data-[popup-open]:bg-muted inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors"
            >
              <MoreVertical className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDuplicate}>
                <Copy className="h-4 w-4" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onLogs}>
                <FileText className="h-4 w-4" />
                View Logs
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={onDelete}>
                <Trash2 className="h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </li>
  );
}
