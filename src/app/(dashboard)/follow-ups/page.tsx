'use client';

import { useCallback, useState, useEffect, useMemo } from 'react';
import { useWorkspace } from '@/hooks/use-workspace';
import { getOrGeneratePatientId } from '@/lib/patients/id-generator';
import {
  Clock,
  Calendar,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  Bell,
  RefreshCw,
  Send,
  Stethoscope,
  Check,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { SendOutboundModal } from '@/components/contacts/send-outbound-modal';
import type { Contact } from '@/types';

interface PatientRef {
  id: string;
  name: string;
  phone: string;
  metadata?: Record<string, unknown>;
}

interface DoctorRef {
  id: string;
  name: string;
  department?: string;
}

interface FollowupItem {
  id: string;
  account_id: string;
  patient_id: string;
  doctor_id?: string;
  followup_type: string;
  due_date: string;
  status: 'scheduled' | 'reminder_sent' | 'completed' | 'cancelled';
  notes?: string;
  last_reminder_sent_at?: string;
  created_at: string;
  patient?: PatientRef;
  doctor?: DoctorRef;
}

export default function FollowupsPage() {
  const { terminology, currentIndustry } = useWorkspace();
  const [followups, setFollowups] = useState<FollowupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<
    'all' | 'today' | 'upcoming' | 'overdue' | 'completed'
  >('all');
  const [search, setSearch] = useState('');
  const [remindingId, setRemindingId] = useState<string | null>(null);

  // New follow-up dialog state
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [patients, setPatients] = useState<PatientRef[]>([]);
  const [doctors, setDoctors] = useState<DoctorRef[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [followupType, setFollowupType] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Quick WhatsApp message modal state
  const [outboundOpen, setOutboundOpen] = useState(false);
  const [outboundTarget, _setOutboundTarget] = useState<Contact | null>(null);

  const PRESET_TYPES = useMemo(() => {
    switch (currentIndustry) {
      case 'real_estate':
        return [
          'Property Inquiry Follow-up',
          'Site Visit Scheduling',
          'Quotation & Pricing Review',
          'Agreement Discussion',
          'Payment Follow-up',
          'General Client Call',
        ];
      case 'salon':
        return [
          'Post-Service Check-in',
          'Product Recommendation',
          'Appointment Rebooking',
          'Membership Renewal',
          'Special Offer Follow-up',
          'General Follow-up',
        ];
      case 'coaching':
      case 'solo_teacher':
        return [
          'Assignment Review',
          'Batch Enrollment Follow-up',
          'Parent Discussion',
          'Fee Reminder',
          'Doubt Clearing Session',
          'Course Feedback',
        ];
      case 'restaurant':
        return [
          'Catering Reservation Follow-up',
          'Special Event Planning',
          'VIP Feedback Check-in',
          'Table Booking Confirmation',
        ];
      case 'travel':
        return [
          'Itinerary Review',
          'Flight & Hotel Confirmation',
          'Visa & Documents Follow-up',
          'Payment Installment Reminder',
          'Trip Feedback',
        ];
      case 'gym':
        return [
          'Membership Renewal Follow-up',
          'Trial Session Follow-up',
          'Plan Upgrade Discussion',
          'Missed Session Check-in',
          'Payment Reminder',
        ];
      case 'hospital_clinic':
        return [
          'General Health Follow-up',
          'Diabetes Review',
          'BP & Hypertension Review',
          'Vaccination Schedule',
          'Dental Cleaning & Check-up',
          'Eye Examination',
          'Physiotherapy Session',
          'Pregnancy ANC Check-up',
          'Post-Op Surgical Review',
        ];
      default:
        return [
          `General ${terminology.followUp}`,
          `${terminology.booking} ${terminology.followUp}`,
          'Payment Reminder',
          'Feedback Check-in',
        ];
    }
  }, [currentIndustry, terminology.followUp, terminology.booking]);

  const fetchFollowups = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/followups?status=${filter}`);
      const data = await res.json();
      setFollowups(data.followups || []);
    } catch {
      toast.error(`Failed to load ${terminology.followUps.toLowerCase()}`);
    } finally {
      setLoading(false);
    }
  }, [filter, terminology.followUps]);

  const fetchPatientsAndDoctors = useCallback(async () => {
    try {
      const [pRes, dRes] = await Promise.all([
        fetch('/api/contacts?limit=100'),
        fetch('/api/doctors?limit=50'),
      ]);
      const pData = await pRes.json();
      const dData = await dRes.json();
      setPatients(pData.contacts || pData.data || []);
      setDoctors(dData.doctors || dData.data || []);
    } catch {
      // Ignore background fetch errors
    }
  }, []);

  useEffect(() => {
    fetchFollowups();
    fetchPatientsAndDoctors();
  }, [fetchFollowups, fetchPatientsAndDoctors]);

  async function handleSendReminder(id: string) {
    setRemindingId(id);
    try {
      const res = await fetch('/api/followups/remind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ followupId: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send reminder');
      toast.success(
        `WhatsApp ${terminology.followUp.toLowerCase()} reminder sent!`
      );
      fetchFollowups();
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Failed to send reminder');
    } finally {
      setRemindingId(null);
    }
  }

  async function handleCompleteTask(id: string) {
    try {
      const res = await fetch('/api/followups', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'completed' }),
      });
      if (!res.ok) throw new Error('Failed to complete task');
      toast.success('Task marked as completed');
      fetchFollowups();
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Failed to complete task');
    }
  }

  async function handleDeleteTask(id: string) {
    try {
      const res = await fetch(`/api/followups?id=${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete task');
      toast.success('Task deleted');
      fetchFollowups();
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Failed to delete task');
    }
  }

  async function handleCreateFollowup() {
    if (!selectedPatientId || !dueDate) {
      toast.error(`${terminology.contact} and Due Date are required`);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/followups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: selectedPatientId,
          doctor_id: selectedDoctorId || null,
          followup_type: followupType || PRESET_TYPES[0],
          due_date: dueDate,
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(
          data.error ||
            `Failed to schedule ${terminology.followUp.toLowerCase()}`
        );
      toast.success(`${terminology.followUp} scheduled successfully!`);
      setNewDialogOpen(false);
      setSelectedPatientId('');
      setSelectedDoctorId('');
      setNotes('');
      fetchFollowups();
    } catch (err: unknown) {
      toast.error(
        (err as Error).message ||
          `Failed to schedule ${terminology.followUp.toLowerCase()}`
      );
    } finally {
      setSubmitting(false);
    }
  }

  const todayStr = new Date().toISOString().split('T')[0];

  const filteredList = followups.filter((item) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const pName = item.patient?.name?.toLowerCase() || '';
    const pPhone = item.patient?.phone || '';
    const fType = item.followup_type.toLowerCase();
    const dName = item.doctor?.name?.toLowerCase() || '';
    const pSeq =
      (item.patient?.metadata?.patient_id as string)?.toLowerCase() || '';
    return (
      pName.includes(q) ||
      pPhone.includes(q) ||
      fType.includes(q) ||
      dName.includes(q) ||
      pSeq.includes(q)
    );
  });

  // Calculate metrics
  const totalCount = followups.length;
  const todayCount = followups.filter(
    (f) => f.due_date === todayStr && f.status === 'scheduled'
  ).length;
  const overdueCount = followups.filter(
    (f) => f.due_date < todayStr && f.status === 'scheduled'
  ).length;
  const remindedCount = followups.filter(
    (f) => f.status === 'reminder_sent'
  ).length;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-foreground flex items-center gap-2 text-2xl font-bold">
            <Clock className="text-primary size-6" />
            {terminology.contact} Tasks & {terminology.followUps}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Automate {terminology.followUp.toLowerCase()} reminders and tasks
            across your {terminology.contacts.toLowerCase()}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={fetchFollowups}
            className="border-border text-muted-foreground hover:bg-muted"
          >
            <RefreshCw className="size-4" />
            Refresh
          </Button>
          <Button
            onClick={() => {
              const defaultDate = new Date(Date.now() + 7 * 86400000)
                .toISOString()
                .split('T')[0];
              setDueDate(defaultDate);
              setNewDialogOpen(true);
            }}
            className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 font-medium"
          >
            <Plus className="size-4" />
            Schedule {terminology.followUp}
          </Button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="border-border bg-card flex items-center gap-3 rounded-xl border p-4">
          <div className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-lg font-bold">
            <Clock className="size-5" />
          </div>
          <div>
            <p className="text-muted-foreground text-xs font-medium">
              Total Active {terminology.followUps}
            </p>
            <p className="text-foreground text-2xl font-bold">{totalCount}</p>
          </div>
        </div>

        <div className="border-border bg-card flex items-center gap-3 rounded-xl border p-4">
          <div className="flex size-10 items-center justify-center rounded-lg bg-amber-500/10 font-bold text-amber-500">
            <Calendar className="size-5" />
          </div>
          <div>
            <p className="text-muted-foreground text-xs font-medium">
              Due Today
            </p>
            <p className="text-foreground text-2xl font-bold">{todayCount}</p>
          </div>
        </div>

        <div className="border-border bg-card flex items-center gap-3 rounded-xl border p-4">
          <div className="flex size-10 items-center justify-center rounded-lg bg-rose-500/10 font-bold text-rose-500">
            <AlertCircle className="size-5" />
          </div>
          <div>
            <p className="text-muted-foreground text-xs font-medium">
              Overdue Reviews
            </p>
            <p className="text-foreground text-2xl font-bold">{overdueCount}</p>
          </div>
        </div>

        <div className="border-border bg-card flex items-center gap-3 rounded-xl border p-4">
          <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/10 font-bold text-emerald-500">
            <Bell className="size-5" />
          </div>
          <div>
            <p className="text-muted-foreground text-xs font-medium">
              Reminders Dispatched
            </p>
            <p className="text-foreground text-2xl font-bold">
              {remindedCount}
            </p>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
        <div className="bg-muted/30 border-border flex flex-wrap items-center gap-1.5 rounded-lg border p-1">
          {(['all', 'today', 'upcoming', 'overdue', 'completed'] as const).map(
            (tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`cursor-pointer rounded-md px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
                  filter === tab
                    ? 'bg-card text-foreground border-border/50 border shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab}
              </button>
            )
          )}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search by ${terminology.contact?.toLowerCase() || 'patient'}, phone, type...`}
            className="bg-card border-border pl-8 text-xs"
          />
        </div>
      </div>

      {/* Table Section */}
      <div className="border-border bg-card overflow-hidden rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 border-border">
              <TableHead className="w-28">{terminology.contact} ID</TableHead>
              <TableHead>{terminology.contact} Details</TableHead>
              <TableHead>Task / {terminology.followUp}</TableHead>
              <TableHead>Assigned / {terminology.staff}</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-muted-foreground py-10 text-center text-sm"
                >
                  Loading {terminology.followUps.toLowerCase()}...
                </TableCell>
              </TableRow>
            ) : filteredList.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center">
                  <Clock className="text-muted-foreground/40 mx-auto mb-2 size-10" />
                  <p className="text-foreground text-sm font-medium">
                    No {terminology.followUps.toLowerCase()} found
                  </p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    Schedule a {terminology.followUp.toLowerCase()} review to
                    keep track of {terminology.contact.toLowerCase()} reminders
                    and tasks.
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              filteredList.map((item) => {
                const patientSeq = getOrGeneratePatientId(item.patient);
                const isOverdue =
                  item.due_date < todayStr && item.status === 'scheduled';
                const isToday =
                  item.due_date === todayStr && item.status === 'scheduled';

                return (
                  <TableRow
                    key={item.id}
                    className="border-border hover:bg-muted/20"
                  >
                    <TableCell className="font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      {patientSeq}
                    </TableCell>
                    <TableCell>
                      <p className="text-foreground text-sm font-semibold">
                        {item.patient?.name || `Unknown ${terminology.contact}`}
                      </p>
                      <p className="text-muted-foreground font-mono text-xs">
                        {item.patient?.phone}
                      </p>
                    </TableCell>
                    <TableCell>
                      <span className="text-foreground bg-primary/10 border-primary/20 inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-semibold">
                        <Stethoscope className="text-primary size-3" />
                        {item.followup_type}
                      </span>
                      {item.notes && (
                        <p className="text-muted-foreground mt-0.5 max-w-xs truncate text-[11px]">
                          {item.notes}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {item.doctor ? `${item.doctor.name}` : 'General Team'}
                    </TableCell>
                    <TableCell>
                      <p className="text-foreground text-xs font-semibold">
                        {item.due_date}
                      </p>
                      {isOverdue && (
                        <span className="text-[10px] font-bold text-rose-500">
                          Overdue
                        </span>
                      )}
                      {isToday && (
                        <span className="text-[10px] font-bold text-amber-500">
                          Due Today
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {item.status === 'reminder_sent' ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/20 bg-sky-500/10 px-2 py-0.5 text-[11px] font-medium text-sky-600 dark:text-sky-400">
                          <Send className="size-3" />
                          Reminder Sent
                        </span>
                      ) : isOverdue ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/20 bg-rose-500/10 px-2 py-0.5 text-[11px] font-medium text-rose-600 dark:text-rose-400">
                          <AlertCircle className="size-3" />
                          Overdue
                        </span>
                      ) : item.status === 'completed' ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="size-3" />
                          Completed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                          <Clock className="size-3" />
                          Scheduled
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {item.status !== 'completed' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleCompleteTask(item.id)}
                            className="h-7 cursor-pointer gap-1 px-2 text-xs font-semibold text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-700"
                            title="Complete Task"
                          >
                            <Check className="size-3.5" />
                            Complete
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={remindingId === item.id}
                          onClick={() => handleSendReminder(item.id)}
                          className="h-7 cursor-pointer gap-1 border-emerald-500/40 bg-emerald-500/10 px-2 text-xs font-semibold text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400"
                          title="Remind on WhatsApp"
                        >
                          <Bell className="size-3.5" />
                          {remindingId === item.id ? '...' : 'Remind'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteTask(item.id)}
                          className="text-muted-foreground h-7 cursor-pointer px-1.5 text-xs hover:bg-rose-500/10 hover:text-rose-600"
                          title="Delete Task"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Schedule Follow-up Dialog */}
      <Dialog open={newDialogOpen} onOpenChange={setNewDialogOpen}>
        <DialogContent className="bg-card border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2 text-lg font-bold">
              <Clock className="text-primary size-5" />
              Schedule {terminology.contact} Task / {terminology.followUp}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div>
              <Label className="text-foreground font-semibold">
                Select {terminology.contact} *
              </Label>
              <select
                value={selectedPatientId}
                onChange={(e) => setSelectedPatientId(e.target.value)}
                className="bg-background border-border text-foreground focus:ring-primary mt-1.5 w-full rounded-lg border p-2.5 text-xs focus:ring-1 focus:outline-none"
              >
                <option value="">-- Choose {terminology.contact} --</option>
                {patients.map((p) => {
                  const seq = p.metadata?.patient_id
                    ? `[${p.metadata.patient_id}] `
                    : '';
                  return (
                    <option key={p.id} value={p.id}>
                      {seq}
                      {p.name} ({p.phone})
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <Label className="text-foreground font-semibold">
                Task / {terminology.followUp} Type *
              </Label>
              <select
                value={followupType || PRESET_TYPES[0]}
                onChange={(e) => setFollowupType(e.target.value)}
                className="bg-background border-border text-foreground focus:ring-primary mt-1.5 w-full rounded-lg border p-2.5 text-xs focus:ring-1 focus:outline-none"
              >
                {PRESET_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label className="text-foreground font-semibold">
                Assigned {terminology.staff} (Optional)
              </Label>
              <select
                value={selectedDoctorId}
                onChange={(e) => setSelectedDoctorId(e.target.value)}
                className="bg-background border-border text-foreground focus:ring-primary mt-1.5 w-full rounded-lg border p-2.5 text-xs focus:ring-1 focus:outline-none"
              >
                <option value="">-- General Team --</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.department || 'General'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label className="text-foreground font-semibold">
                Due Date *
              </Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="bg-background border-border mt-1.5 text-xs"
              />
            </div>

            <div>
              <Label className="text-foreground font-semibold">
                Instructions & Notes
              </Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={`Any instructions for this ${terminology.followUp.toLowerCase()}...`}
                className="bg-background border-border mt-1.5 text-xs"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setNewDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={submitting}
              onClick={handleCreateFollowup}
              className="bg-primary text-primary-foreground font-medium"
            >
              {submitting
                ? 'Scheduling...'
                : `Schedule ${terminology.followUp}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Outbound WhatsApp Modal */}
      <SendOutboundModal
        open={outboundOpen}
        onOpenChange={setOutboundOpen}
        defaultContact={outboundTarget}
      />
    </div>
  );
}
