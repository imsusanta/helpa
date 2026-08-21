'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2,
  Clock,
  Plus,
  Loader2,
  Calendar,
  Trash2,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

interface FollowupItem {
  id: string;
  patient_id: string;
  followup_type: string;
  due_date: string;
  status: 'scheduled' | 'reminder_sent' | 'completed' | 'cancelled';
  notes?: string;
  created_at: string;
}

interface ContactTasksTabProps {
  contactId: string;
  contactName?: string;
}

export function ContactTasksTab({
  contactId,
  contactName,
}: ContactTasksTabProps) {
  const [tasks, setTasks] = useState<FollowupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [taskType, setTaskType] = useState('Call Follow-up');
  const [dueDate, setDueDate] = useState('');
  const [taskNotes, setTaskNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchTasks = useCallback(async () => {
    if (!contactId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/followups?contact_id=${contactId}`);
      if (res.ok) {
        const json = await res.json();
        setTasks(json.followups || []);
      }
    } catch (err) {
      console.error('Failed to fetch contact tasks:', err);
    } finally {
      setLoading(false);
    }
  }, [contactId]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dueDate) {
      toast.error('Please select a due date');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/followups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_id: contactId,
          patient_id: contactId,
          followup_type: taskType,
          due_date: dueDate,
          notes: taskNotes,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create task');
      }

      toast.success('Task created successfully');
      setNewModalOpen(false);
      setTaskNotes('');
      setDueDate('');
      fetchTasks();
    } catch (err) {
      toast.error((err as Error).message || 'Failed to create task');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (task: FollowupItem) => {
    const nextStatus = task.status === 'completed' ? 'scheduled' : 'completed';
    try {
      const res = await fetch('/api/followups', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: task.id,
          status: nextStatus,
        }),
      });

      if (!res.ok) throw new Error('Failed to update status');

      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, status: nextStatus } : t))
      );
      toast.success(
        nextStatus === 'completed' ? 'Task completed' : 'Task marked scheduled'
      );
    } catch {
      toast.error('Failed to update task');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/followups?id=${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete');
      setTasks((prev) => prev.filter((t) => t.id !== id));
      toast.success('Task deleted');
    } catch {
      toast.error('Failed to delete task');
    }
  };

  return (
    <div className="flex h-full flex-col space-y-3 p-4">
      {/* Header with New Task button */}
      <div className="border-border/50 flex items-center justify-between border-b pb-2">
        <div className="flex items-center gap-2">
          <Clock className="text-primary size-4" />
          <span className="text-foreground text-xs font-semibold">
            Tasks & Follow-ups ({tasks.length})
          </span>
        </div>
        <Button
          size="sm"
          onClick={() => {
            const today = new Date().toISOString().split('T')[0];
            setDueDate(today);
            setNewModalOpen(true);
          }}
          className="h-7 cursor-pointer gap-1 text-xs"
        >
          <Plus className="size-3.5" />
          Add Task
        </Button>
      </div>

      {/* Task List */}
      <div className="flex-1 space-y-2.5 overflow-y-auto pr-1">
        {loading ? (
          <div className="text-muted-foreground flex flex-col items-center justify-center py-12">
            <Loader2 className="text-primary size-6 animate-spin" />
            <span className="mt-2 text-xs">Loading tasks...</span>
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-muted-foreground flex flex-col items-center justify-center py-12 text-center">
            <CheckCircle2 className="size-8 text-emerald-500 opacity-40" />
            <p className="mt-2 text-xs font-medium">
              No pending tasks for this contact
            </p>
            <p className="text-muted-foreground mt-0.5 text-[11px]">
              Schedule follow-ups, calls, or review reminders directly from
              here.
            </p>
          </div>
        ) : (
          tasks.map((t) => {
            const isCompleted = t.status === 'completed';
            const isOverdue =
              !isCompleted &&
              t.due_date < new Date().toISOString().split('T')[0];

            return (
              <div
                key={t.id}
                className={`flex items-start justify-between gap-3 rounded-lg border p-3 shadow-xs transition-colors ${
                  isCompleted
                    ? 'border-border/40 bg-muted/30 opacity-70'
                    : isOverdue
                      ? 'border-red-500/30 bg-red-500/5'
                      : 'border-border bg-card'
                }`}
              >
                <div className="flex min-w-0 flex-1 items-start gap-2.5">
                  <button
                    onClick={() => handleToggleStatus(t)}
                    className={`mt-0.5 flex size-4.5 shrink-0 items-center justify-center rounded border transition-colors ${
                      isCompleted
                        ? 'border-emerald-500 bg-emerald-500 text-white'
                        : 'border-muted-foreground/50 hover:border-primary'
                    }`}
                    title={
                      isCompleted ? 'Mark as incomplete' : 'Mark as completed'
                    }
                  >
                    {isCompleted && <Check className="size-3 stroke-[3]" />}
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-semibold ${
                          isCompleted
                            ? 'text-muted-foreground line-through'
                            : 'text-foreground'
                        }`}
                      >
                        {t.followup_type}
                      </span>
                      {isOverdue && (
                        <Badge
                          variant="destructive"
                          className="px-1.5 py-0 text-[10px]"
                        >
                          Overdue
                        </Badge>
                      )}
                      {isCompleted && (
                        <Badge
                          variant="outline"
                          className="border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0 text-[10px] text-emerald-600"
                        >
                          Completed
                        </Badge>
                      )}
                    </div>
                    {t.notes && (
                      <p className="text-muted-foreground mt-1 text-xs">
                        {t.notes}
                      </p>
                    )}
                    <div className="text-muted-foreground mt-1.5 flex items-center gap-2 font-mono text-[11px]">
                      <Calendar className="size-3" />
                      <span>Due: {t.due_date}</span>
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive size-7"
                    onClick={() => handleDelete(t.id)}
                    title="Delete task"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* New Task Dialog */}
      <Dialog open={newModalOpen} onOpenChange={setNewModalOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleCreateTask}>
            <DialogHeader>
              <DialogTitle className="text-sm font-semibold">
                Schedule Task / Follow-up for {contactName || 'Contact'}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3 py-3">
              <div className="space-y-1">
                <Label className="text-xs">Task Type</Label>
                <select
                  value={taskType}
                  onChange={(e) => setTaskType(e.target.value)}
                  className="border-input bg-background focus:ring-primary w-full rounded-md border px-3 py-1.5 text-xs focus:ring-1"
                >
                  <option value="Call Follow-up">Call Follow-up</option>
                  <option value="WhatsApp Message Follow-up">
                    WhatsApp Message Follow-up
                  </option>
                  <option value="Proposal / Quote Follow-up">
                    Proposal / Quote Follow-up
                  </option>
                  <option value="Appointment / Visit Follow-up">
                    Appointment / Visit Follow-up
                  </option>
                  <option value="Payment / Invoice Reminder">
                    Payment / Invoice Reminder
                  </option>
                  <option value="General Task">General Task</option>
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Due Date</Label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  required
                  className="text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Notes / Details</Label>
                <Textarea
                  value={taskNotes}
                  onChange={(e) => setTaskNotes(e.target.value)}
                  placeholder="Add notes about what to discuss or accomplish..."
                  rows={3}
                  className="text-xs"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setNewModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-1 size-3.5 animate-spin" /> Saving...
                  </>
                ) : (
                  'Schedule Task'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
