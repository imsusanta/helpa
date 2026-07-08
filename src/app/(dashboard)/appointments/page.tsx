"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Calendar as CalendarIcon,
  Clock,
  User,
  Plus,
  Loader2,
  Check,
  X,
  UserCheck,
  Building,
} from "lucide-react";
import { toast } from "sonner";

interface Appointment {
  id: string;
  appointment_date: string;
  appointment_time: string;
  status: string;
  notes: string;
  patient: { id: string; name: string; phone: string } | null;
  doctor: { id: string; name: string; specialization: string } | null;
  department: string;
  token_number?: number;
  queue_position?: number;
}

interface Doctor {
  id: string;
  name: string;
  department: string;
  specialization: string;
}

interface Patient {
  id: string;
  name: string;
}

export default function AppointmentsPage() {
  const { accountId } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"upcoming" | "queue" | "completed" | "cancelled">("upcoming");

  // Form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [patientId, setPatientId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [department, setDepartment] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const loadAllData = useCallback(async () => {
    if (!accountId) return;
    const db = createClient();

    try {
      // 1. Fetch appointments
      const { data: appts } = await db
        .from("appointments")
        .select("id, appointment_date, appointment_time, status, notes, department, token_number, queue_position, patient:contacts(id, name, phone), doctor:hospital_doctors(id, name, specialization)")
        .eq("account_id", accountId)
        .order("appointment_date", { ascending: true })
        .order("appointment_time", { ascending: true });

      setAppointments((appts as any) || []);

      // 2. Fetch doctors dropdown
      const { data: docs } = await db
        .from("hospital_doctors")
        .select("id, name, department, specialization")
        .eq("account_id", accountId)
        .eq("status", "active");

      setDoctors(docs || []);

      // 3. Fetch patients (contacts) dropdown
      const { data: pats } = await db
        .from("patients")
        .select("id, contact:contacts(name)")
        .eq("account_id", accountId);

      const mappedPats = (pats || []).map((p: any) => ({
        id: p.id,
        name: p.contact?.name || "Unknown Patient",
      }));
      setPatients(mappedPats);
    } catch (err) {
      console.error("Error loading appointments dataset:", err);
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const handleCreateAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId || !date || !time) {
      toast.error("Please fill in patient, date, and time.");
      return;
    }

    setSaving(true);
    const db = createClient();

    try {
      const selectedDoc = doctors.find((d) => d.id === doctorId);
      const apptDept = selectedDoc ? selectedDoc.department : department || "General";

      const { error } = await db.from("appointments").insert({
        account_id: accountId,
        patient_id: patientId,
        doctor_id: doctorId || null,
        department: apptDept,
        appointment_date: date,
        appointment_time: time,
        status: "pending",
        notes: notes || null,
      });

      if (error) throw error;

      toast.success("Appointment scheduled successfully!");
      setPatientId("");
      setDoctorId("");
      setDepartment("");
      setDate("");
      setTime("");
      setNotes("");
      setShowAddForm(false);
      loadAllData();
    } catch (err: any) {
      toast.error("Failed to book appointment: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateStatus = async (apptId: string, newStatus: string) => {
    const db = createClient();
    try {
      const { error } = await db
        .from("appointments")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", apptId);

      if (error) throw error;
      toast.success(`Appointment status updated to ${newStatus}.`);
      loadAllData();
    } catch (err: any) {
      toast.error("Status update failed: " + err.message);
    }
  };

  // Filter based on active tabs
  const filteredAppointments = appointments.filter((appt) => {
    const today = new Date().toISOString().split("T")[0];
    if (activeTab === "upcoming") {
      return (appt.status === "pending" || appt.status === "confirmed" || appt.status === "calling") && appt.appointment_date >= today;
    }
    if (activeTab === "queue") {
      return appt.appointment_date === today && appt.status !== "cancelled" && appt.status !== "completed";
    }
    if (activeTab === "completed") {
      return appt.status === "completed" || (appt.appointment_date < today && appt.status !== "cancelled");
    }
    return appt.status === "cancelled" || appt.status === "no_show";
  });

  const displayAppointments = activeTab === "queue"
    ? [...filteredAppointments].sort((a, b) => (a.token_number || 0) - (b.token_number || 0))
    : filteredAppointments;

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
          <h1 className="text-2xl font-bold text-foreground">Appointments</h1>
          <p className="text-sm text-muted-foreground font-medium">Schedule and manage patient clinical consultations.</p>
        </div>
        <Button onClick={() => setShowAddForm(!showAddForm)} className="cursor-pointer">
          <Plus className="h-4 w-4 mr-2" /> New Appointment
        </Button>
      </div>

      {showAddForm && (
        <form onSubmit={handleCreateAppointment} className="bg-card border border-border rounded-xl p-5 space-y-4 max-w-2xl animate-in fade-in slide-in-from-top-4 duration-200">
          <h3 className="font-bold text-foreground">New Appointment</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Select Patient *</Label>
              <select value={patientId} onChange={(e) => setPatientId(e.target.value)} required className="w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <option value="">-- Select Patient --</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Select Doctor (Optional)</Label>
              <select value={doctorId} onChange={(e) => setDoctorId(e.target.value)} className="w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <option value="">-- Choose Doctor --</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>{d.name} ({d.department})</option>
                ))}
              </select>
            </div>
            {!doctorId && (
              <div className="space-y-2">
                <Label>Clinical Department</Label>
                <Input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="e.g. Pediatrics, Cardiology" />
              </div>
            )}
            <div className="space-y-2">
              <Label>Appointment Date *</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Appointment Time *</Label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Special Instructions / Symptoms / Notes</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Brief consultation notes..." />
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => setShowAddForm(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Schedule Appointment
            </Button>
          </div>
        </form>
      )}

      {/* Tabs */}
      <div className="flex border-b border-border">
        {(["upcoming", "queue", "completed", "cancelled"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 border-b-2 text-sm font-semibold capitalize transition-colors ${
              activeTab === tab
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab === "queue"
              ? "Live Queue"
              : tab === "upcoming"
              ? "Upcoming Appointments"
              : tab === "completed"
              ? "Completed"
              : "Cancelled / No Show"}
          </button>
        ))}
      </div>

      {/* Grid listing */}
      {displayAppointments.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl p-12 text-center max-w-2xl mx-auto">
          <CalendarIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-bold text-foreground">No appointments here</h3>
          <p className="text-muted-foreground text-sm mt-1">There are no consultations matching this filter.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-muted-foreground">
              <thead className="text-xs uppercase bg-muted/50 border-b border-border text-foreground font-semibold">
                <tr>
                  <th className="px-6 py-4">Patient</th>
                  <th className="px-6 py-4">Doctor</th>
                  <th className="px-6 py-4">Token Info</th>
                  <th className="px-6 py-4">Schedule Date/Time</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-foreground">
                {displayAppointments.map((appt) => (
                  <tr key={appt.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4 font-semibold">
                      <div className="flex items-center gap-2">
                        <User className="h-4.5 w-4.5 text-muted-foreground/70" />
                        <div>
                          <div>{appt.patient?.name || "Unknown Patient"}</div>
                          <div className="text-xs text-muted-foreground font-normal">{appt.patient?.phone}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium">
                      <div className="flex items-center gap-2">
                        <UserCheck className="h-4.5 w-4.5 text-muted-foreground/70" />
                        <div>
                          <div>{appt.doctor?.name || "Unassigned"}</div>
                          <div className="text-xs text-muted-foreground font-normal">{appt.doctor?.specialization}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-bold text-foreground/80">
                      {appt.token_number ? `#${appt.token_number} (Pos: ${appt.queue_position})` : "-"}
                    </td>
                    <td className="px-6 py-4 font-semibold text-primary">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-4 w-4" />
                        <span>{appt.appointment_date} at {appt.appointment_time}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                        appt.status === "confirmed"
                          ? "bg-emerald-500/10 text-emerald-500"
                          : appt.status === "pending"
                          ? "bg-amber-500/10 text-amber-500"
                          : appt.status === "calling"
                          ? "bg-blue-500/10 text-blue-500 animate-pulse"
                          : appt.status === "completed"
                          ? "bg-indigo-500/10 text-indigo-500"
                          : "bg-red-500/10 text-red-500"
                      }`}>
                        {appt.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-1.5 flex justify-end items-center">
                      <a
                        href={`/api/appointments/${appt.id}/pdf`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center rounded-md border border-border bg-card hover:bg-muted text-xs py-1.5 px-3 font-semibold text-foreground cursor-pointer transition-colors"
                      >
                        PDF Slip
                      </a>

                      {activeTab === "queue" && (
                        <>
                          {appt.status !== "calling" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleUpdateStatus(appt.id, "calling")}
                              className="bg-blue-500/10 border-blue-500/20 text-blue-500 hover:bg-blue-500/20 text-xs py-1 px-2.5 cursor-pointer"
                            >
                              Call Token
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleUpdateStatus(appt.id, "completed")}
                            className="bg-emerald-500/10 border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/20 text-xs py-1 px-2.5 cursor-pointer"
                          >
                            Complete
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleUpdateStatus(appt.id, "cancelled")}
                            className="bg-red-500/10 border-red-500/20 text-red-500 hover:bg-red-500/20 text-xs py-1 px-2.5 cursor-pointer"
                          >
                            Skip
                          </Button>
                        </>
                      )}

                      {activeTab !== "queue" && (
                        <>
                          {appt.status === "pending" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleUpdateStatus(appt.id, "confirmed")}
                              className="bg-emerald-500/10 border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/20 text-xs py-1 px-2.5 cursor-pointer"
                            >
                              Confirm
                            </Button>
                          )}
                          {appt.status === "confirmed" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleUpdateStatus(appt.id, "completed")}
                              className="bg-indigo-500/10 border-indigo-500/20 text-indigo-500 hover:bg-indigo-500/20 text-xs py-1 px-2.5 cursor-pointer"
                            >
                              Complete
                            </Button>
                          )}
                          {appt.status !== "cancelled" && appt.status !== "completed" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleUpdateStatus(appt.id, "cancelled")}
                              className="bg-red-500/10 border-red-500/20 text-red-500 hover:bg-red-500/20 text-xs py-1 px-2.5 cursor-pointer"
                            >
                              Cancel
                            </Button>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
