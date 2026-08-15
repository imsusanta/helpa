'use client';

import { ConfirmDialog } from '@/components/ui/confirm-dialog';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Stethoscope,
  Plus,
  Loader2,
  Clock,
  Calendar,
  Building,
  Edit,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

interface Doctor {
  id: string;
  name: string;
  department: string;
  specialization: string;
  working_hours: { start: string; end: string };
  available_days: string[];
  consultation_fee: number;
  status: string;
}

const ALL_DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

export default function DoctorsPage() {
  const { accountId, defaultCurrency } = useAuth();
  void defaultCurrency;
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [fee, setFee] = useState('');
  const [startHour, setStartHour] = useState('09:00');
  const [endHour, setEndHour] = useState('17:00');
  const [selectedDays, setSelectedDays] = useState<string[]>([
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
  ]);
  const [saving, setSaving] = useState(false);
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [docStatus, setDocStatus] = useState('active');
  const [docIdToDelete, setDocIdToDelete] = useState<string | null>(null);
  const [deletingDoc, setDeletingDoc] = useState(false);

  const loadDoctors = useCallback(async () => {
    if (!accountId) return;
    try {
      const res = await fetch('/api/doctors', {
        credentials: 'include',
        cache: 'no-store',
      });
      if (res.ok) {
        const payload = await res.json();
        setDoctors(payload.data || []);
      } else {
        const errPayload = await res.json().catch(() => ({}));
        console.error('Error loading doctors:', errPayload);
      }
    } catch (err) {
      console.error('Error loading doctors:', err);
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    loadDoctors();
  }, [loadDoctors]);

  const toggleDay = (day: string) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleSaveDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !department) {
      toast.error('Please fill in Doctor Name and Department.');
      return;
    }

    setSaving(true);

    try {
      const payload = {
        name,
        department,
        specialization: specialization || null,
        consultation_fee: parseFloat(fee) || 0,
        working_hours: { start: startHour, end: endHour },
        available_days: selectedDays,
        status: docStatus,
      };

      if (editingDocId) {
        const res = await fetch(`/api/doctors/${editingDocId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to update doctor');
        }

        toast.success('Doctor profile updated successfully!');
      } else {
        const res = await fetch('/api/doctors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to create doctor');
        }

        toast.success('Doctor registered successfully!');
      }

      setName('');
      setDepartment('');
      setSpecialization('');
      setFee('');
      setStartHour('09:00');
      setEndHour('17:00');
      setSelectedDays(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
      setDocStatus('active');
      setEditingDocId(null);
      setShowAddForm(false);
      loadDoctors();
    } catch (err: unknown) {
      toast.error('Failed to save doctor: ' + (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (doc: Doctor) => {
    setEditingDocId(doc.id);
    setName(doc.name);
    setDepartment(doc.department);
    setSpecialization(doc.specialization || '');
    setFee(doc.consultation_fee.toString());
    setStartHour(doc.working_hours?.start || '09:00');
    setEndHour(doc.working_hours?.end || '17:00');
    setSelectedDays(doc.available_days || []);
    setDocStatus(doc.status || 'active');
    setShowAddForm(true);
  };

  const handleDeleteDoctor = async (docId: string) => {
    setDocIdToDelete(docId);
  };

  const executeDeleteDoctor = async () => {
    if (!docIdToDelete) return;
    setDeletingDoc(true);
    try {
      const res = await fetch(`/api/doctors/${docIdToDelete}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to delete doctor');
      }

      toast.success('Doctor deleted successfully!');
      setDocIdToDelete(null);
      loadDoctors();
    } catch (err: unknown) {
      toast.error('Failed to delete doctor: ' + (err as Error).message);
    } finally {
      setDeletingDoc(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="text-primary h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-foreground text-2xl font-bold">Doctors</h1>
          <p className="text-muted-foreground text-sm font-medium">
            Manage clinical staff on-call rotas and consultation rates.
          </p>
        </div>
        <Button
          onClick={() => setShowAddForm(!showAddForm)}
          className="cursor-pointer"
        >
          <Plus className="mr-2 h-4 w-4" /> New Doctor
        </Button>
      </div>

      {showAddForm && (
        <form
          onSubmit={handleSaveDoctor}
          className="bg-card border-border animate-in fade-in slide-in-from-top-4 max-w-2xl space-y-4 rounded-xl border p-5 duration-200"
        >
          <h3 className="text-foreground font-bold">
            {editingDocId ? 'Edit Doctor Profile' : 'New Doctor Profile'}
          </h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Doctor Name *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Dr. Sarah Jenkins"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Department *</Label>
              <Input
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="e.g. Cardiology, Pediatrics"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Specialization</Label>
              <Input
                value={specialization}
                onChange={(e) => setSpecialization(e.target.value)}
                placeholder="e.g. Pediatric Surgery"
              />
            </div>
            <div className="space-y-2">
              <Label>Consultation Fee (₹)</Label>
              <Input
                type="number"
                value={fee}
                onChange={(e) => setFee(e.target.value)}
                placeholder="e.g. 500"
              />
            </div>
            <div className="space-y-2">
              <Label>Shift Start Hour</Label>
              <Input
                type="time"
                value={startHour}
                onChange={(e) => setStartHour(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Shift End Hour</Label>
              <Input
                type="time"
                value={endHour}
                onChange={(e) => setEndHour(e.target.value)}
              />
            </div>
            {editingDocId && (
              <div className="space-y-2">
                <Label>Status</Label>
                <select
                  value={docStatus}
                  onChange={(e) => setDocStatus(e.target.value)}
                  className="border-input bg-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            )}
            <div className="space-y-2 md:col-span-2">
              <Label className="mb-1.5 block">Available Working Days</Label>
              <div className="flex flex-wrap gap-2">
                {ALL_DAYS.map((day) => {
                  const active = selectedDays.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(day)}
                      className={`rounded border px-2.5 py-1.5 text-xs transition-colors ${
                        active
                          ? 'bg-primary border-primary text-primary-foreground font-semibold'
                          : 'border-border hover:bg-muted text-muted-foreground'
                      }`}
                    >
                      {day.slice(0, 3)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowAddForm(false);
                setEditingDocId(null);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save
              Doctor
            </Button>
          </div>
        </form>
      )}

      {doctors.length === 0 ? (
        <div className="border-border mx-auto max-w-2xl rounded-xl border border-dashed p-12 text-center">
          <Stethoscope className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
          <h3 className="text-foreground text-lg font-bold">
            No doctors registered
          </h3>
          <p className="text-muted-foreground mt-1 mb-4 text-sm">
            Register on-call medical practitioners to allocate shift rotas.
          </p>
          <Button onClick={() => setShowAddForm(true)}>New Doctor</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {doctors.map((doc) => (
            <div
              key={doc.id}
              className="bg-card border-border flex flex-col gap-4 rounded-xl border p-5 transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div className="bg-primary/10 text-primary border-primary/25 flex h-12 w-12 items-center justify-center rounded-full border text-base font-bold shadow-inner">
                  {doc.name
                    .replace(/^Dr\.\s+/i, '')
                    .split(' ')
                    .map((w) => w[0])
                    .filter(Boolean)
                    .slice(0, 2)
                    .join('')
                    .toUpperCase()}
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase ${
                    doc.status === 'active'
                      ? 'bg-emerald-500/10 text-emerald-500'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {doc.status}
                </span>
              </div>
              <div>
                <h3 className="text-foreground text-lg leading-tight font-bold">
                  {doc.name}
                </h3>
                <p className="text-muted-foreground mt-2.5 flex items-center text-xs">
                  <Building className="text-muted-foreground/70 mr-1 h-4 w-4" />{' '}
                  {doc.department}{' '}
                  {doc.specialization ? `(${doc.specialization})` : ''}
                </p>
                <p className="text-muted-foreground mt-1 flex items-center text-xs">
                  <Clock className="text-muted-foreground/70 mr-1 h-4 w-4" />{' '}
                  {doc.working_hours?.start || '09:00'} -{' '}
                  {doc.working_hours?.end || '17:00'}
                </p>
                <p className="text-muted-foreground mt-1 flex items-center text-xs">
                  <Calendar className="text-muted-foreground/70 mr-1 h-4 w-4" />{' '}
                  {doc.available_days?.map((d) => d.slice(0, 3)).join(', ')}
                </p>
              </div>
              <div className="border-border mt-auto flex items-center justify-between border-t pt-4">
                <span className="text-muted-foreground text-xs">
                  Consultation Fee
                </span>
                <p className="text-foreground text-lg font-extrabold">
                  ₹{doc.consultation_fee}
                </p>
              </div>
              <div className="border-border/40 mt-1 flex justify-end gap-2 border-t pt-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => startEdit(doc)}
                  className="text-foreground border-border hover:bg-muted flex cursor-pointer items-center gap-1 px-3 py-1 text-xs font-semibold"
                >
                  <Edit className="h-3.5 w-3.5" /> Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteDoctor(doc.id)}
                  className="flex cursor-pointer items-center gap-1 px-3 py-1 text-xs font-semibold text-red-500 hover:bg-red-500/10 hover:text-red-600"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      <ConfirmDialog
        open={!!docIdToDelete}
        onOpenChange={(open) => !open && setDocIdToDelete(null)}
        title="Delete Doctor Profile"
        description="Are you sure you want to delete this doctor? This will remove all their scheduling data."
        onConfirm={executeDeleteDoctor}
        loading={deletingDoc}
      />
    </div>
  );
}
