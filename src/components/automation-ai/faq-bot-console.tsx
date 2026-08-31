'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  MessageSquareText,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  HelpCircle,
  BookOpen,
  Lightbulb,
} from 'lucide-react';

import { useAuth } from '@/hooks/use-auth';
import { getIndustryAiPreset } from '@/lib/ai/industry-ai-presets';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GatedButton } from '@/components/ui/gated-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';

import { ModuleHeader } from './module-header';
import { AiStatCard } from './ai-stat-card';
import { useAiStats } from './use-ai-stats';

interface KbEntry {
  id: string;
  category: string;
  question_title: string;
  answer_content: string;
  created_at: string;
  updated_at: string;
}

export function FaqBotConsole({ embedded = false }: { embedded?: boolean }) {
  const { account, canSendMessages } = useAuth();
  const preset = getIndustryAiPreset(account?.industry);
  const {
    ai: aiStats,
    loading: statsLoading,
    refresh: refreshStats,
  } = useAiStats();

  const [entries, setEntries] = useState<KbEntry[] | null>(null);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<KbEntry | null>(null);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [saving, setSaving] = useState(false);

  const [pendingDelete, setPendingDelete] = useState<KbEntry | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/account/kb');
      if (!res.ok) {
        setEntries([]);
        return;
      }
      const data = (await res.json()) as KbEntry[];
      // This console manages the conversational FAQ answers specifically.
      setEntries(
        Array.isArray(data) ? data.filter((e) => e.category === 'faq') : []
      );
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate(prefillQuestion = '') {
    setEditing(null);
    setQuestion(prefillQuestion);
    setAnswer('');
    setDialogOpen(true);
  }

  function openEdit(entry: KbEntry) {
    setEditing(entry);
    setQuestion(entry.question_title);
    setAnswer(entry.answer_content);
    setDialogOpen(true);
  }

  async function handleSubmit() {
    if (!question.trim() || !answer.trim()) {
      toast.error('Both a question and an answer are required');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/account/kb', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(editing ? { id: editing.id } : {}),
          category: 'faq',
          question_title: question.trim(),
          answer_content: answer.trim(),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to save FAQ');
      }
      toast.success(editing ? 'FAQ updated' : 'FAQ added');
      setDialogOpen(false);
      await load();
      void refreshStats();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save FAQ');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/account/kb?id=${encodeURIComponent(pendingDelete.id)}`,
        { method: 'DELETE' }
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to delete FAQ');
      }
      toast.success('FAQ deleted');
      setPendingDelete(null);
      await load();
      void refreshStats();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete FAQ');
    } finally {
      setDeleting(false);
    }
  }

  // Preset sample questions not yet covered — offered as quick-add prompts.
  const existingQuestions = new Set(
    (entries ?? []).map((e) => e.question_title.trim().toLowerCase())
  );
  const suggestions = preset.sampleQuestions.filter(
    (q) => !existingQuestions.has(q.trim().toLowerCase())
  );

  return (
    <div className="space-y-6">
      {!embedded ? (
        <ModuleHeader
          icon={MessageSquareText}
          title="FAQ Bot"
          description="Curate the questions your AI answers instantly. These FAQ entries are part of your knowledge base and are used to answer customers on WhatsApp."
          action={
            <GatedButton
              canAct={canSendMessages}
              gateReason="manage FAQs"
              onClick={() => openCreate()}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add FAQ
            </GatedButton>
          }
        />
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h2 className="text-foreground text-lg font-semibold">FAQ Bot</h2>
            <p className="text-muted-foreground text-sm">
              Instant answers your {preset.assistantRole.toLowerCase()} uses on
              WhatsApp.
            </p>
          </div>
          <GatedButton
            canAct={canSendMessages}
            gateReason="manage FAQs"
            onClick={() => openCreate()}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add FAQ
          </GatedButton>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <AiStatCard
          icon={HelpCircle}
          label="FAQ answers"
          value={entries ? entries.length : '—'}
          loading={loading}
          accent="emerald"
        />
        <AiStatCard
          icon={BookOpen}
          label="Total knowledge base entries"
          value={
            aiStats ? aiStats.knowledge_base_entries.toLocaleString() : '—'
          }
          sublabel="Across all categories"
          loading={statsLoading}
          accent="blue"
        />
        <AiStatCard
          icon={MessageSquareText}
          label="Conversations"
          value={aiStats ? aiStats.conversations.toLocaleString() : '—'}
          loading={statsLoading}
          accent="violet"
        />
      </div>

      {suggestions.length > 0 && canSendMessages ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Lightbulb className="h-4 w-4 text-amber-500" />
              Suggested questions for your industry
            </CardTitle>
            <CardDescription>
              Common questions {preset.assistantRole.toLowerCase()}s handle. Tap
              to draft an answer.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {suggestions.map((q) => (
              <Button
                key={q}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => openCreate(q)}
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                {q}
              </Button>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-6">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : !entries || entries.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={MessageSquareText}
                title="No FAQ answers yet"
                description="Add the questions your customers ask most, so your AI can answer them instantly on WhatsApp."
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[38%]">Question</TableHead>
                  <TableHead>Answer</TableHead>
                  <TableHead className="w-[100px] text-right">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="align-top font-medium">
                      {entry.question_title}
                    </TableCell>
                    <TableCell className="text-muted-foreground align-top text-sm">
                      <span className="line-clamp-2">
                        {entry.answer_content}
                      </span>
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="flex justify-end gap-1">
                        <GatedButton
                          canAct={canSendMessages}
                          gateReason="manage FAQs"
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(entry)}
                        >
                          <Pencil className="h-4 w-4" />
                        </GatedButton>
                        <GatedButton
                          canAct={canSendMessages}
                          gateReason="manage FAQs"
                          variant="ghost"
                          size="icon"
                          onClick={() => setPendingDelete(entry)}
                        >
                          <Trash2 className="text-destructive h-4 w-4" />
                        </GatedButton>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit FAQ' : 'Add FAQ'}</DialogTitle>
            <DialogDescription>
              {editing
                ? 'Update this question and answer.'
                : 'Add a question your AI should be able to answer instantly.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="faq-question">Question</Label>
              <Input
                id="faq-question"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="e.g. What are your opening hours?"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="faq-answer">Answer</Label>
              <Textarea
                id="faq-answer"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                rows={5}
                placeholder="Write the answer your AI should give…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={saving}>
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {editing ? 'Save changes' : 'Add FAQ'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Delete FAQ?"
        description={
          pendingDelete
            ? `"${pendingDelete.question_title}" will be removed from your knowledge base.`
            : ''
        }
        onConfirm={handleDelete}
        loading={deleting}
      />
    </div>
  );
}
