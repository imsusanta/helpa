"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { formatCurrency } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  UserCheck,
  Stethoscope,
  Plus,
  Loader2,
  Clock,
  Calendar,
  Building,
  Edit,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

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

const ALL_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function DoctorsPage() {
  const { accountId, defaultCurrency } = useAuth();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [fee, setFee] = useState("");
  const [startHour, setStartHour] = useState("09:00");
  const [endHour, setEndHour] = useState("17:00");
  const [selectedDays, setSelectedDays] = useState<string[]>(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]);
  const [saving, setSaving] = useState(false);
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [docStatus, setDocStatus] = useState("active");

  const loadDoctors = useCallback(async () => {
    if (!accountId) return;
    const db = createClient();
    const { data, error } = await db
      .from("hospital_doctors")
      .select("*")
      .eq("account_id", accountId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading doctors:", error);
    } else {
      setDoctors(data || []);
    }
    setLoading(false);
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
      toast.error("Please fill in Doctor Name and Department.");
      return;
    }

    setSaving(true);
    const db = createClient();

    try {
      if (editingDocId) {
        const { error } = await db
          .from("hospital_doctors")
          .update({
            name,
            department,
            specialization: specialization || null,
            consultation_fee: parseFloat(fee) || 0,
            working_hours: { start: startHour, end: endHour },
            available_days: selectedDays,
            status: docStatus,
          })
          .eq("id", editingDocId);

        if (error) throw error;
        toast.success("Doctor profile updated successfully!");
      } else {
        const { error } = await db.from("hospital_doctors").insert({
          account_id: accountId,
          name,
          department,
          specialization: specialization || null,
          consultation_fee: parseFloat(fee) || 0,
          working_hours: { start: startHour, end: endHour },
          available_days: selectedDays,
          status: "active",
        });

        if (error) throw error;
        toast.success("Doctor registered successfully!");
      }

      setName("");
      setDepartment("");
      setSpecialization("");
      setFee("");
      setStartHour("09:00");
      setEndHour("17:00");
      setSelectedDays(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]);
      setDocStatus("active");
      setEditingDocId(null);
      setShowAddForm(false);
      loadDoctors();
    } catch (err: any) {
      toast.error("Failed to save doctor: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (doc: Doctor) => {
    setEditingDocId(doc.id);
    setName(doc.name);
    setDepartment(doc.department);
    setSpecialization(doc.specialization || "");
    setFee(doc.consultation_fee.toString());
    setStartHour(doc.working_hours?.start || "09:00");
    setEndHour(doc.working_hours?.end || "17:00");
    setSelectedDays(doc.available_days || []);
    setDocStatus(doc.status || "active");
    setShowAddForm(true);
  };

  const handleDeleteDoctor = async (docId: string) => {
    if (!confirm("Are you sure you want to delete this doctor? This will remove all their scheduling data.")) return;

    const db = createClient();
    try {
      const { error } = await db
        .from("hospital_doctors")
        .delete()
        .eq("id", docId);

      if (error) throw error;

      toast.success("Doctor deleted successfully!");
      loadDoctors();
    } catch (err: any) {
      toast.error("Failed to delete doctor: " + err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Doctors</h1>
          <p className="text-sm text-muted-foreground font-medium">Manage clinical staff on-call rotas and consultation rates.</p>
        </div>
        <Button onClick={() => setShowAddForm(!showAddForm)} className="cursor-pointer">
          <Plus className="h-4 w-4 mr-2" /> New Doctor
        </Button>
      </div>

      {showAddForm && (
        <form onSubmit={handleSaveDoctor} className="bg-card border border-border rounded-xl p-5 space-y-4 max-w-2xl animate-in fade-in slide-in-from-top-4 duration-200">
          <h3 className="font-bold text-foreground">{editingDocId ? "Edit Doctor Profile" : "New Doctor Profile"}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Doctor Name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Dr. Sarah Jenkins" required />
            </div>
            <div className="space-y-2">
              <Label>Department *</Label>
              <Input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="e.g. Cardiology, Pediatrics" required />
            </div>
            <div className="space-y-2">
              <Label>Specialization</Label>
              <Input value={specialization} onChange={(e) => setSpecialization(e.target.value)} placeholder="e.g. Pediatric Surgery" />
            </div>
            <div className="space-y-2">
              <Label>Consultation Fee (₹)</Label>
              <Input type="number" value={fee} onChange={(e) => setFee(e.target.value)} placeholder="e.g. 500" />
            </div>
            <div className="space-y-2">
              <Label>Shift Start Hour</Label>
              <Input type="time" value={startHour} onChange={(e) => setStartHour(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Shift End Hour</Label>
              <Input type="time" value={endHour} onChange={(e) => setEndHour(e.target.value)} />
            </div>
            {editingDocId && (
              <div className="space-y-2">
                <Label>Status</Label>
                <select
                  value={docStatus}
                  onChange={(e) => setDocStatus(e.target.value)}
                  className="w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            )}
            <div className="space-y-2 md:col-span-2">
              <Label className="block mb-1.5">Available Working Days</Label>
              <div className="flex flex-wrap gap-2">
                {ALL_DAYS.map((day) => {
                  const active = selectedDays.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(day)}
                      className={`text-xs px-2.5 py-1.5 rounded border transition-colors ${
                        active
                          ? "bg-primary border-primary text-primary-foreground font-semibold"
                          : "border-border hover:bg-muted text-muted-foreground"
                      }`}
                    >
                      {day.slice(0, 3)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => { setShowAddForm(false); setEditingDocId(null); }}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Save Doctor
            </Button>
          </div>
        </form>
      )}

      {doctors.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl p-12 text-center max-w-2xl mx-auto">
          <Stethoscope className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-bold text-foreground">No doctors registered</h3>
          <p className="text-muted-foreground text-sm mt-1 mb-4">Register on-call medical practitioners to allocate shift rotas.</p>
          <Button onClick={() => setShowAddForm(true)}>New Doctor</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {doctors.map((doc) => (
            <div key={doc.id} className="bg-card border border-border rounded-xl p-5 hover:shadow-md transition-shadow flex flex-col gap-4">
              <div className="flex justify-between items-start">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-base border border-primary/25 shadow-inner">
                  {doc.name.replace(/^Dr\.\s+/i, "").split(" ").map(w => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase()}
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${
                  doc.status === "active" ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground"
                }`}>
                  {doc.status}
                </span>
              </div>
              <div>
                <h3 className="font-bold text-foreground text-lg leading-tight">{doc.name}</h3>
                <p className="text-muted-foreground text-xs flex items-center mt-2.5">
                  <Building className="h-4 w-4 mr-1 text-muted-foreground/70" /> {doc.department} {doc.specialization ? `(${doc.specialization})` : ""}
                </p>
                <p className="text-muted-foreground text-xs flex items-center mt-1">
                  <Clock className="h-4 w-4 mr-1 text-muted-foreground/70" /> {doc.working_hours?.start || "09:00"} - {doc.working_hours?.end || "17:00"}
                </p>
                <p className="text-muted-foreground text-xs flex items-center mt-1">
                  <Calendar className="h-4 w-4 mr-1 text-muted-foreground/70" /> {doc.available_days?.map((d) => d.slice(0,3)).join(", ")}
                </p>
              </div>
              <div className="border-t border-border pt-4 mt-auto flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Consultation Fee</span>
                <p className="text-lg font-extrabold text-foreground">
                  ₹{doc.consultation_fee}
                </p>
              </div>
              <div className="flex gap-2 justify-end mt-1 border-t border-border/40 pt-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => startEdit(doc)}
                  className="cursor-pointer text-xs font-semibold text-foreground py-1 px-3 border-border hover:bg-muted flex items-center gap-1"
                >
                  <Edit className="h-3.5 w-3.5" /> Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteDoctor(doc.id)}
                  className="cursor-pointer text-xs font-semibold text-red-500 hover:text-red-600 hover:bg-red-500/10 py-1 px-3 flex items-center gap-1"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
