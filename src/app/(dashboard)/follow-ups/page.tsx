'use client';

import { useState, useEffect } from 'react';
import {
  Clock,
  Calendar,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  Bell,
  UserCheck,
  Users,
  Filter,
  RefreshCw,
  Send,
  FileText,
  Stethoscope,
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
  metadata?: any;
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
  const [followups, setFollowups] = useState<FollowupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'today' | 'upcoming' | 'overdue' | 'completed'>('all');
  const [search, setSearch] = useState('');
  const [remindingId, setRemindingId] = useState<string | null>(null);

  // New follow-up dialog state
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [patients, setPatients] = useState<PatientRef[]>([]);
  const [doctors, setDoctors] = useState<DoctorRef[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [followupType, setFollowupType] = useState('Diabetes Review');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Quick WhatsApp message modal state
  const [outboundOpen, setOutboundOpen] = useState(false);
  const [outboundTarget, setOutboundTarget] = useState<Contact | null>(null);

  const PRESET_TYPES = [
    'Diabetes Review',
    'BP & Hypertension Review',
    'Vaccination Schedule',
    'Dental Cleaning & Check-up',
    'Eye Examination',
    'Physiotherapy Session',
    'Pregnancy ANC Check-up',
    'Post-Op Surgical Review',
    'General Health Follow-up',
  ];

  useEffect(() => {
    fetchFollowups();
    fetchPatientsAndDoctors();
  }, [filter]);

  async function fetchFollowups() {
    setLoading(true);
    try {
      const res = await fetch(`/api/followups?status=${filter}`);
      const data = await res.json();
      setFollowups(data.followups || []);
    } catch (err) {
      toast.error('Failed to load follow-ups');
    } finally {
      setLoading(false);
    }
  }

  async function fetchPatientsAndDoctors() {
    try {
      const [pRes, dRes] = await Promise.all([
        fetch('/api/contacts?limit=100'),
        fetch('/api/doctors?limit=50'),
      ]);
      const pData = await pRes.json();
      const dData = await dRes.json();
      setPatients(pData.contacts || pData.data || []);
      setDoctors(dData.doctors || dData.data || []);
    } catch (e) {
      // Ignore background fetch errors
    }
  }

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
      toast.success('WhatsApp follow-up reminder sent!');
      fetchFollowups();
    } catch (err: any) {
      toast.error(err.message || 'Failed to send reminder');
    } finally {
      setRemindingId(null);
    }
  }

  async function handleCreateFollowup() {
    if (!selectedPatientId || !dueDate) {
      toast.error('Patient and Due Date are required');
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
          followup_type: followupType,
          due_date: dueDate,
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to schedule follow-up');
      toast.success('Follow-up scheduled successfully!');
      setNewDialogOpen(false);
      setSelectedPatientId('');
      setSelectedDoctorId('');
      setNotes('');
      fetchFollowups();
    } catch (err: any) {
      toast.error(err.message || 'Failed to schedule follow-up');
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
    const pSeq = item.patient?.metadata?.patient_id?.toLowerCase() || '';
    return pName.includes(q) || pPhone.includes(q) || fType.includes(q) || dName.includes(q) || pSeq.includes(q);
  });

  // Calculate metrics
  const totalCount = followups.length;
  const todayCount = followups.filter((f) => f.due_date === todayStr && f.status === 'scheduled').length;
  const overdueCount = followups.filter((f) => f.due_date < todayStr && f.status === 'scheduled').length;
  const remindedCount = followups.filter((f) => f.status === 'reminder_sent').length;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Clock className="size-6 text-primary" />
            Patient Follow-ups & Care Reviews
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Automate clinic follow-up care, chronic condition reviews, and WhatsApp reminders.
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
              const defaultDate = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
              setDueDate(defaultDate);
              setNewDialogOpen(true);
            }}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium gap-2"
          >
            <Plus className="size-4" />
            Schedule Follow-up
          </Button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
          <div className="size-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
            <Clock className="size-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Total Active Follow-ups</p>
            <p className="text-2xl font-bold text-foreground">{totalCount}</p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
          <div className="size-10 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold">
            <Calendar className="size-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Due Today</p>
            <p className="text-2xl font-bold text-foreground">{todayCount}</p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
          <div className="size-10 rounded-lg bg-rose-500/10 text-rose-500 flex items-center justify-center font-bold">
            <AlertCircle className="size-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Overdue Reviews</p>
            <p className="text-2xl font-bold text-foreground">{overdueCount}</p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
          <div className="size-10 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold">
            <Bell className="size-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Reminders Dispatched</p>
            <p className="text-2xl font-bold text-foreground">{remindedCount}</p>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1.5 bg-muted/30 border border-border p-1 rounded-lg">
          {(['all', 'today', 'upcoming', 'overdue', 'completed'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md capitalize transition-colors cursor-pointer ${
                filter === tab
                  ? 'bg-card text-foreground shadow-xs border border-border/50'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by patient, phone, type..."
            className="pl-8 bg-card border-border text-xs"
          />
        </div>
      </div>

      {/* Table Section */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 border-border">
              <TableHead className="w-28">Patient ID</TableHead>
              <TableHead>Patient Details</TableHead>
              <TableHead>Follow-up Type</TableHead>
              <TableHead>Consulting Doctor</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-muted-foreground text-sm">
                  Loading follow-ups...
                </TableCell>
              </TableRow>
            ) : filteredList.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12">
                  <Clock className="size-10 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm font-medium text-foreground">No follow-ups found</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Schedule a follow-up review to keep track of patient recovery and reminders.
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              filteredList.map((item) => {
                const patientSeq = item.patient?.metadata?.patient_id || 'PAT-000000';
                const isOverdue = item.due_date < todayStr && item.status === 'scheduled';
                const isToday = item.due_date === todayStr && item.status === 'scheduled';

                return (
                  <TableRow key={item.id} className="border-border hover:bg-muted/20">
                    <TableCell className="font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      {patientSeq}
                    </TableCell>
                    <TableCell>
                      <p className="font-semibold text-foreground text-sm">{item.patient?.name || 'Unknown Patient'}</p>
                      <p className="text-xs text-muted-foreground font-mono">{item.patient?.phone}</p>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-foreground bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-md">
                        <Stethoscope className="size-3 text-primary" />
                        {item.followup_type}
                      </span>
                      {item.notes && <p className="text-[11px] text-muted-foreground mt-0.5 max-w-xs truncate">{item.notes}</p>}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {item.doctor ? `Dr. ${item.doctor.name}` : 'General Clinic'}
                    </TableCell>
                    <TableCell>
                      <p className="text-xs font-semibold text-foreground">{item.due_date}</p>
                      {isOverdue && <span className="text-[10px] font-bold text-rose-500">Overdue</span>}
                      {isToday && <span className="text-[10px] font-bold text-amber-500">Due Today</span>}
                    </TableCell>
                    <TableCell>
                      {item.status === 'reminder_sent' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-sky-600 dark:text-sky-400 bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 rounded-full">
                          <Send className="size-3" />
                          Reminder Sent
                        </span>
                      ) : isOverdue ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-600 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-full">
                          <AlertCircle className="size-3" />
                          Overdue
                        </span>
                      ) : item.status === 'completed' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="size-3" />
                          Completed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                          <Clock className="size-3" />
                          Scheduled
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={remindingId === item.id}
                          onClick={() => handleSendReminder(item.id)}
                          className="border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 text-xs font-semibold gap-1"
                        >
                          <Bell className="size-3.5" />
                          {remindingId === item.id ? 'Sending...' : 'Remind WhatsApp'}
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
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
              <Clock className="size-5 text-primary" />
              Schedule Patient Follow-up
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div>
              <Label className="text-foreground font-semibold">Select Patient *</Label>
              <select
                value={selectedPatientId}
                onChange={(e) => setSelectedPatientId(e.target.value)}
                className="w-full mt-1.5 bg-background border border-border rounded-lg p-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">-- Choose Patient --</option>
                {patients.map((p) => {
                  const seq = p.metadata?.patient_id ? `[${p.metadata.patient_id}] ` : '';
                  return (
                    <option key={p.id} value={p.id}>
                      {seq}{p.name} ({p.phone})
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <Label className="text-foreground font-semibold">Follow-up Review Type *</Label>
              <select
                value={followupType}
                onChange={(e) => setFollowupType(e.target.value)}
                className="w-full mt-1.5 bg-background border border-border rounded-lg p-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {PRESET_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label className="text-foreground font-semibold">Consulting Doctor (Optional)</Label>
              <select
                value={selectedDoctorId}
                onChange={(e) => setSelectedDoctorId(e.target.value)}
                className="w-full mt-1.5 bg-background border border-border rounded-lg p-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">-- Clinic General --</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    Dr. {d.name} ({d.department || 'General'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label className="text-foreground font-semibold">Due Date *</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="mt-1.5 bg-background border-border text-xs"
              />
            </div>

            <div>
              <Label className="text-foreground font-semibold">Instructions & Clinical Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Fasting blood sugar report required before consultation."
                className="mt-1.5 bg-background border-border text-xs"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setNewDialogOpen(false)}>
              Cancel
            </Button>
            <Button disabled={submitting} onClick={handleCreateFollowup} className="bg-primary text-primary-foreground font-medium">
              {submitting ? 'Scheduling...' : 'Schedule Follow-up'}
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
