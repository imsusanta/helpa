'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { salesApi } from '@/lib/sales/api-client';
import { useAuth } from '@/hooks/use-auth';
import { CURRENCIES } from '@/lib/currency';
import type {
  Contact,
  Conversation,
  Deal,
  DealStatus,
  PipelineStage,
  Profile,
} from '@/types';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Check,
  X,
  Trash2,
  MessageSquare,
  DollarSign,
  Loader2,
  Sparkles,
  Lightbulb,
  Wallet,
  Clock,
  Target,
} from 'lucide-react';
import { toast } from 'sonner';
import { useWorkspace } from '@/hooks/use-workspace';

interface DealFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal?: Deal | null;
  pipelineId: string;
  stages: PipelineStage[];
  defaultStageId?: string;
  onSaved: () => void;
}

export function DealForm({
  open,
  onOpenChange,
  deal,
  pipelineId,
  stages,
  defaultStageId,
  onSaved,
}: DealFormProps) {
  const { defaultCurrency } = useAuth();
  const { terminology } = useWorkspace();

  const [title, setTitle] = useState('');
  const [value, setValue] = useState('');
  const [currency, setCurrency] = useState(defaultCurrency);
  const [contactId, setContactId] = useState('');
  const [stageId, setStageId] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [expectedCloseDate, setExpectedCloseDate] = useState('');
  const [notes, setNotes] = useState('');

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [linkedConversation, setLinkedConversation] =
    useState<Conversation | null>(null);

  const [saving, setSaving] = useState(false);
  const [statusAction, setStatusAction] = useState<DealStatus | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Reset the form fields every time the sheet opens or its input
  // props change.
  useEffect(() => {
    if (!open) return;
    setConfirmDelete(false);
    if (deal) {
      setTitle(deal.name || deal.title || '');
      setValue(String(deal.value ?? ''));
      setCurrency(deal.currency || defaultCurrency);
      setContactId(deal.contact_id ?? '');
      setStageId(deal.stage_id);
      setAssignedTo(deal.assigned_user_id || deal.assigned_to || '');
      setExpectedCloseDate(deal.expected_close_date ?? '');
      setNotes(deal.notes ?? '');
    } else {
      setTitle('');
      setValue('');
      setCurrency(defaultCurrency);
      setContactId('');
      setStageId(defaultStageId || stages[0]?.id || '');
      setAssignedTo('');
      setExpectedCloseDate('');
      setNotes('');
    }
  }, [open, deal, defaultStageId, stages, defaultCurrency]);

  // Load supporting data once the sheet is open
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const [contactsRes, membersRes] = await Promise.all([
          salesApi<Contact[]>('/api/contacts'),
          salesApi<Profile[]>('/api/members').catch(() => []),
        ]);
        if (cancelled) return;
        setContacts(Array.isArray(contactsRes) ? contactsRes : []);
        setProfiles(Array.isArray(membersRes) ? membersRes : []);
      } catch {
        // fallback
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Fetch linked conversation for the selected contact (newest open one).
  useEffect(() => {
    if (!open || !contactId) {
      setLinkedConversation(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await salesApi<Conversation[]>(
          `/api/inbox/conversations?contact_id=${contactId}`
        ).catch(() => null);
        if (cancelled) return;
        if (Array.isArray(data) && data.length > 0) {
          setLinkedConversation(data[0]);
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, contactId]);

  async function handleSave() {
    if (!title.trim() || !contactId || !stageId) {
      toast.error('Title, contact, and stage are required');
      return;
    }
    setSaving(true);

    const payload = {
      name: title.trim(),
      title: title.trim(),
      value: parseFloat(value) || 0,
      currency,
      contact_id: contactId,
      pipeline_id: pipelineId,
      stage_id: stageId,
      assigned_user_id: assignedTo || null,
      assigned_to: assignedTo || null,
      notes: notes.trim() || null,
      expected_close_date: expectedCloseDate || null,
    };

    try {
      if (deal) {
        await salesApi(`/api/deals/${deal.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await salesApi('/api/deals', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      setSaving(false);
      toast.success(
        `${terminology.pipelineItem} ${deal ? 'updated' : 'created'}`
      );
      onOpenChange(false);
      onSaved();
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Failed to save deal');
      setSaving(false);
    }
  }

  async function handleStatusChange(status: DealStatus) {
    if (!deal) return;
    let lostReason: string | undefined;
    if (status === 'lost') {
      const userPrompt = window.prompt(
        'Please provide a reason for marking this deal as LOST:'
      );
      if (userPrompt === null) return;
      lostReason =
        userPrompt.trim() ||
        `Marked lost from ${terminology.pipelineItem} form`;
    }

    setStatusAction(status);
    try {
      await salesApi(`/api/deals/${deal.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status, lost_reason: lostReason }),
      });
      setStatusAction(null);
      toast.success(
        status === 'won'
          ? 'Marked as won'
          : status === 'lost'
            ? 'Marked as lost'
            : `${terminology.pipelineItem} reopened`
      );
      onOpenChange(false);
      onSaved();
    } catch (err: unknown) {
      setStatusAction(null);
      toast.error((err as Error).message || 'Failed to update deal status');
    }
  }

  async function handleDelete() {
    if (!deal) return;
    setDeleting(true);
    try {
      await salesApi(`/api/deals/${deal.id}`, {
        method: 'DELETE',
      });
      setDeleting(false);
      toast.success(`${terminology.pipelineItem} deleted`);
      setConfirmDelete(false);
      onOpenChange(false);
      onSaved();
    } catch (err: unknown) {
      setDeleting(false);
      toast.error((err as Error).message || 'Failed to delete deal');
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="bg-popover border-border text-popover-foreground w-full p-0 sm:max-w-lg"
      >
        <div className="flex h-full flex-col">
          <SheetHeader className="border-border/50 border-b p-4">
            <SheetTitle className="text-popover-foreground">
              {deal
                ? `Edit ${terminology.pipelineItem}`
                : `New ${terminology.pipelineItem}`}
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            <div className="grid gap-2">
              <Label className="text-muted-foreground">Title</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={`${terminology.pipelineItem} title`}
                className="border-border bg-muted text-foreground"
              />
            </div>

            <div className="grid gap-2">
              <Label className="text-muted-foreground">
                {terminology.person}
              </Label>
              <select
                value={contactId}
                onChange={(e) => setContactId(e.target.value)}
                className="border-border bg-muted text-foreground focus:border-primary focus:ring-primary h-9 w-full rounded-lg border px-2.5 text-sm outline-none focus:ring-1"
              >
                <option value="">
                  Select a {terminology.person.toLowerCase()}
                </option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name || c.phone}
                  </option>
                ))}
              </select>

              {linkedConversation && (
                <Link
                  href="/inbox"
                  className="bg-primary/10 text-primary hover:bg-primary/20 mt-1 inline-flex items-center gap-1.5 self-start rounded-md px-2 py-1 text-xs"
                >
                  <MessageSquare className="h-3 w-3" />
                  Link to Conversation
                </Link>
              )}
            </div>

            {deal &&
              (deal.ai_lead_score ||
                deal.ai_summary ||
                deal.ai_next_action ||
                deal.ai_product_service) && (
                <div className="border-primary/10 bg-primary/5 space-y-3 rounded-xl border p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-primary flex items-center gap-1.5 text-xs font-semibold">
                      <Sparkles className="h-3.5 w-3.5" />
                      AI Assistant Insights
                    </div>
                    {deal.ai_lead_score && (
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold capitalize ${
                          deal.ai_lead_score === 'hot'
                            ? 'border-red-500/20 bg-red-500/10 text-red-400'
                            : deal.ai_lead_score === 'warm'
                              ? 'border-orange-500/20 bg-orange-500/10 text-orange-400'
                              : 'border-blue-500/20 bg-blue-500/10 text-blue-400'
                        }`}
                      >
                        {deal.ai_lead_score} {terminology.pipelineItem}
                      </span>
                    )}
                  </div>

                  {deal.ai_summary && (
                    <div className="space-y-1">
                      <span className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                        Summary
                      </span>
                      <p className="text-foreground text-xs leading-relaxed">
                        {deal.ai_summary}
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    {deal.ai_product_service && (
                      <div className="space-y-0.5">
                        <span className="text-muted-foreground block text-[10px] font-bold tracking-wider uppercase">
                          {terminology.service}/Product
                        </span>
                        <span className="text-foreground inline-flex items-center gap-1 text-xs font-medium">
                          <Target className="text-primary h-3 w-3" />
                          {deal.ai_product_service}
                        </span>
                      </div>
                    )}
                    {deal.ai_budget && (
                      <div className="space-y-0.5">
                        <span className="text-muted-foreground block text-[10px] font-bold tracking-wider uppercase">
                          Budget
                        </span>
                        <span className="text-foreground inline-flex items-center gap-1 text-xs font-medium">
                          <Wallet className="h-3 w-3 text-emerald-500" />
                          {deal.ai_budget}
                        </span>
                      </div>
                    )}
                    {deal.ai_timeline && (
                      <div className="col-span-2 space-y-0.5">
                        <span className="text-muted-foreground block text-[10px] font-bold tracking-wider uppercase">
                          Timeline
                        </span>
                        <span className="text-foreground inline-flex items-center gap-1 text-xs font-medium">
                          <Clock className="h-3 w-3 text-amber-500" />
                          {deal.ai_timeline}
                        </span>
                      </div>
                    )}
                  </div>

                  {deal.ai_next_action && (
                    <div className="bg-background/50 border-border/50 mt-2 flex items-start gap-2 rounded-lg border p-2.5">
                      <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                      <div className="space-y-0.5">
                        <span className="text-muted-foreground block text-[10px] font-bold tracking-wider uppercase">
                          Recommended Next Action
                        </span>
                        <p className="text-foreground text-xs leading-snug">
                          {deal.ai_next_action}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

            <div className="grid grid-cols-[1fr_110px] gap-3">
              <div className="grid gap-2">
                <Label className="text-muted-foreground">
                  Estimated Consultation Value
                </Label>
                <div className="relative">
                  <DollarSign className="text-muted-foreground absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2" />
                  <Input
                    type="number"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="0"
                    className="border-border bg-muted text-foreground pl-7"
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label className="text-muted-foreground">Currency</Label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="border-border bg-muted text-foreground focus:border-primary h-9 w-full rounded-lg border px-2.5 text-sm outline-none"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label className="text-muted-foreground">
                Target Close / {terminology.followUp} Date
              </Label>
              <Input
                type="date"
                value={expectedCloseDate}
                onChange={(e) => setExpectedCloseDate(e.target.value)}
                className="border-border bg-muted text-foreground"
              />
            </div>

            <div className="grid gap-2">
              <Label className="text-muted-foreground">Stage</Label>
              <select
                value={stageId}
                onChange={(e) => setStageId(e.target.value)}
                className="border-border bg-muted text-foreground focus:border-primary h-9 w-full rounded-lg border px-2.5 text-sm outline-none"
              >
                {stages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              <Label className="text-muted-foreground">Assigned To</Label>
              <select
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="border-border bg-muted text-foreground focus:border-primary h-9 w-full rounded-lg border px-2.5 text-sm outline-none"
              >
                <option value="">Unassigned</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name || p.email}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              <Label className="text-muted-foreground">Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes..."
                className="border-border bg-muted text-foreground min-h-[100px]"
              />
            </div>

            {deal && (
              <div className="border-border bg-muted/50 space-y-2 rounded-lg border p-3">
                <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                  Status
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    onClick={() => handleStatusChange('won')}
                    disabled={!!statusAction || deal.status === 'won'}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 flex-1 disabled:opacity-50"
                  >
                    {statusAction === 'won' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Check className="mr-1 h-4 w-4" />
                        Mark as Won
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => handleStatusChange('lost')}
                    disabled={!!statusAction || deal.status === 'lost'}
                    className="flex-1 bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {statusAction === 'lost' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <X className="mr-1 h-4 w-4" />
                        Mark as Lost
                      </>
                    )}
                  </Button>
                </div>
                {deal.status && deal.status !== 'open' && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => handleStatusChange('open')}
                    disabled={!!statusAction}
                    className="text-muted-foreground hover:text-foreground w-full"
                  >
                    Reopen deal
                  </Button>
                )}
              </div>
            )}
          </div>

          <div className="border-border/50 bg-popover/80 border-t p-4">
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="border-border text-muted-foreground hover:bg-muted flex-1 bg-transparent"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving || !title.trim() || !contactId || !stageId}
                className="bg-primary text-primary-foreground hover:bg-primary/90 flex-1"
              >
                {saving
                  ? 'Saving...'
                  : deal
                    ? 'Save Changes'
                    : `Create ${terminology.pipelineItem}`}
              </Button>
            </div>

            {deal &&
              (confirmDelete ? (
                <div className="mt-3 flex items-center justify-between gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs">
                  <span className="text-red-300">Delete this deal?</span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      disabled={deleting}
                      className="text-muted-foreground hover:bg-muted rounded px-2 py-1"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={deleting}
                      className="rounded bg-red-600 px-2 py-1 font-medium text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      {deleting ? 'Deleting...' : 'Confirm'}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="mt-3 flex w-full items-center justify-center gap-1 text-xs text-red-400 hover:text-red-300"
                >
                  <Trash2 className="h-3 w-3" />
                  Delete {terminology.pipelineItem}
                </button>
              ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
