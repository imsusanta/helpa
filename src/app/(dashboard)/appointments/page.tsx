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
  Users,
  Search,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { DEFAULT_BOOKING_FORM_CONFIG } from "@/lib/booking-form/config";

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

interface PatientSearchMatch {
  id: string;
  patient_seq_id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  gender?: string;
  date_of_birth?: string;
  blood_group?: string;
  emergency_contact?: string;
}

export default function AppointmentsPage() {
  const { accountId } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [formConfig, setFormConfig] = useState<Record<string, { show: boolean; required: boolean }>>(DEFAULT_BOOKING_FORM_CONFIG);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"upcoming" | "queue" | "completed" | "cancelled">("upcoming");

  // Booking Form Modal State
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingApptId, setEditingApptId] = useState<string | null>(null);

  // Real-time Patient Lookup & Family Sharing State
  const [mobileQuery, setMobileQuery] = useState("");
  const [patientMatches, setPatientMatches] = useState<PatientSearchMatch[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<PatientSearchMatch | null>(null);
  const [createNewFamilyMember, setCreateNewFamilyMember] = useState(false);
  const [searchingPatients, setSearchingPatients] = useState(false);

  // Dynamic Form Field States
  const [patientName, setPatientName] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [dob, setDob] = useState("");
  const [address, setAddress] = useState("");
  const [bloodGroup, setBloodGroup] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [guardianMobile, setGuardianMobile] = useState("");
  const [email, setEmail] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [department, setDepartment] = useState("");
  const [appointmentType, setAppointmentType] = useState("");
  const [reasonForVisit, setReasonForVisit] = useState("");
  const [insuranceProvider, setInsuranceProvider] = useState("");
  const [insuranceNumber, setInsuranceNumber] = useState("");
  const [referredBy, setReferredBy] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const loadAllData = useCallback(async () => {
    if (!accountId) return;
    const db = createClient();

    try {
      // 1. Fetch booking form settings config
      fetch("/api/account/booking-form")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.config) {
            setFormConfig({
              ...DEFAULT_BOOKING_FORM_CONFIG,
              ...data.config,
            });
          }
        })
        .catch((e) => console.error("Form config load error:", e));

      // 2. Fetch appointments
      const { data: appts } = await db
        .from("appointments")
        .select("id, appointment_date, appointment_time, status, notes, department, token_number, queue_position, patient:contacts(id, name, phone), doctor:hospital_doctors(id, name, specialization)")
        .eq("account_id", accountId)
        .order("appointment_date", { ascending: true })
        .order("appointment_time", { ascending: true });

      setAppointments((appts as any) || []);

      // 3. Fetch doctors dropdown
      const { data: docs } = await db
        .from("hospital_doctors")
        .select("id, name, department, specialization")
        .eq("account_id", accountId)
        .eq("status", "active");

      setDoctors(docs || []);
    } catch (err) {
      console.error("Error loading appointments dataset:", err);
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Real-time phone search effect with debouncing
  useEffect(() => {
    if (!mobileQuery || mobileQuery.trim().length < 4) {
      setPatientMatches([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearchingPatients(true);
      try {
        const res = await fetch(`/api/patients/search?phone=${encodeURIComponent(mobileQuery.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setPatientMatches(data.patients || []);
        }
      } catch (err) {
        console.error("Patient phone search failed:", err);
      } finally {
        setSearchingPatients(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [mobileQuery]);

  function resetForm() {
    setPatientName("");
    setMobileNumber("");
    setMobileQuery("");
    setPatientMatches([]);
    setSelectedPatient(null);
    setCreateNewFamilyMember(false);
    setAge("");
    setGender("");
    setDob("");
    setAddress("");
    setBloodGroup("");
    setEmergencyContact("");
    setGuardianName("");
    setGuardianMobile("");
    setEmail("");
    setDoctorId("");
    setDepartment("");
    setAppointmentType("");
    setReasonForVisit("");
    setInsuranceProvider("");
    setInsuranceNumber("");
    setReferredBy("");
    setDate("");
    setTime("");
    setNotes("");
  }

  function handleSelectExistingPatient(p: PatientSearchMatch) {
    setSelectedPatient(p);
    setPatientName(p.name);
    setMobileNumber(p.phone);
    setAge("");
    setGender(p.gender || "");
    setAddress(p.address || "");
    setBloodGroup(p.blood_group || "");
    setEmail(p.email || "");
    setEmergencyContact(p.emergency_contact || "");
    setCreateNewFamilyMember(false);
    toast.info(`Selected patient ${p.name} (${p.patient_seq_id})`);
  }

  const handleCreateAppointment = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate mandatory required fields based on formConfig
    if (formConfig.name?.required && !patientName.trim()) {
      toast.error("Patient Name is required.");
      return;
    }
    if (formConfig.phone?.required && !mobileNumber.trim()) {
      toast.error("Mobile Number is required.");
      return;
    }
    if (formConfig.doctor_id?.required && !doctorId) {
      toast.error("Preferred Doctor selection is required.");
      return;
    }
    if (formConfig.department?.required && !department && !doctorId) {
      toast.error("Department selection is required.");
      return;
    }

    // Set default date/time if empty
    const apptDate = date || new Date().toISOString().split("T")[0];
    const apptTime = time || "10:00";

    setSaving(true);
    const db = createClient();

    try {
      let finalContactId = selectedPatient?.id;

      // Create new patient if no existing patient selected or creating new family member
      if (!finalContactId || createNewFamilyMember) {
        // 1. Create contact record
        const { data: newContact, error: contactError } = await db
          .from("contacts")
          .insert({
            account_id: accountId,
            name: patientName.trim(),
            phone: mobileNumber.trim(),
            email: email.trim() || null,
            address: address.trim() || null,
            metadata: {
              age: age || null,
              gender: gender || null,
              blood_group: bloodGroup || null,
              guardian_name: guardianName || null,
              guardian_mobile: guardianMobile || null,
              insurance_provider: insuranceProvider || null,
              insurance_number: insuranceNumber || null,
              referred_by: referredBy || null,
            },
          })
          .select("id")
          .single();

        if (contactError || !newContact) throw new Error("Failed to create patient profile: " + contactError?.message);

        finalContactId = newContact.id;

        // 2. Create patient record (triggers PAT-XXXXXX auto-sequence assignment)
        await db.from("patients").insert({
          id: finalContactId,
          account_id: accountId,
          gender: gender || null,
          date_of_birth: dob || null,
          blood_group: bloodGroup || null,
          emergency_contact: emergencyContact || null,
        });
      }

      const selectedDoc = doctors.find((d) => d.id === doctorId);
      const apptDept = selectedDoc ? selectedDoc.department : department || "General";

      // 3. Create appointment record
      const { data: newAppt, error: apptError } = await db
        .from("appointments")
        .insert({
          account_id: accountId,
          patient_id: finalContactId,
          doctor_id: doctorId || null,
          department: apptDept,
          appointment_date: apptDate,
          appointment_time: apptTime,
          status: "pending",
          notes: notes.trim() || null,
        })
        .select("id")
        .single();

      if (apptError) throw apptError;

      // 4. Trigger WhatsApp Confirmation notification asynchronously
      if (newAppt?.id) {
        fetch(`/api/appointments/${newAppt.id}/confirm`, { method: "POST" }).catch(() => {});
      }

      toast.success("Appointment booked successfully! Confirmation sent.");
      resetForm();
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
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground flex items-center gap-2">
            Appointments & OPD Reception
            <span className="text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20">
              Live Desk
            </span>
          </h1>
          <p className="text-xs text-muted-foreground font-medium mt-0.5">
            Schedule and manage patient clinical consultations with auto-generated Patient IDs & WhatsApp confirmations.
          </p>
        </div>
        <Button
          onClick={() => {
            if (!showAddForm) resetForm();
            setShowAddForm(!showAddForm);
            setShowEditForm(false);
          }}
          className="bg-emerald-700 dark:bg-emerald-600 hover:bg-emerald-600 dark:hover:bg-emerald-500 text-white font-bold cursor-pointer transition-all shadow-md shadow-emerald-600/10 self-start sm:self-auto"
        >
          <Plus className="h-4 w-4 mr-2" /> Book Appointment
        </Button>
      </div>

      {/* Configurable Booking Form Modal */}
      {showAddForm && (
        <form
          onSubmit={handleCreateAppointment}
          className="bg-card border border-emerald-500/20 rounded-2xl p-6 space-y-6 max-w-3xl shadow-xl animate-in fade-in slide-in-from-top-4 duration-200"
        >
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h3 className="font-extrabold text-foreground text-lg flex items-center gap-2">
              <Sparkles className="size-5 text-emerald-500" />
              Book Clinical Appointment
            </h3>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowAddForm(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </Button>
          </div>

          {/* Step 1: Mobile Number Search & Multi-Patient Detection */}
          <div className="space-y-3 bg-muted/30 border border-border p-4 rounded-xl">
            <Label className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
              <Search className="size-3.5 text-emerald-500" /> Step 1: Enter Mobile Number or Search Existing Patient
            </Label>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  value={mobileNumber}
                  onChange={(e) => {
                    const val = e.target.value;
                    setMobileNumber(val);
                    setMobileQuery(val);
                    if (selectedPatient && selectedPatient.phone !== val) {
                      setSelectedPatient(null);
                    }
                  }}
                  placeholder="Type Mobile Number (e.g. 9876543210)..."
                  className="bg-background text-sm font-semibold pr-8"
                  required={formConfig.phone?.required}
                />
                {searchingPatients && (
                  <Loader2 className="size-4 animate-spin text-emerald-500 absolute right-2.5 top-3" />
                )}
              </div>
            </div>

            {/* Display Matching Patient Cards for Family Sharing */}
            {patientMatches.length > 0 && !selectedPatient && (
              <div className="space-y-2 pt-2 animate-in fade-in duration-200">
                <p className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <Users className="size-3.5" /> Multiple patient profiles found for this mobile number:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {patientMatches.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => handleSelectExistingPatient(p)}
                      className="p-3 rounded-lg border border-border bg-card hover:border-emerald-500/50 hover:bg-emerald-500/5 cursor-pointer transition-all space-y-1 group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                          {p.name}
                        </span>
                        <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                          {p.patient_seq_id}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        Phone: {p.phone} {p.gender ? `• ${p.gender}` : ''} {p.blood_group ? `• ${p.blood_group}` : ''}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedPatient(null);
                      setCreateNewFamilyMember(true);
                      toast.info("Registering new family member profile for this number.");
                    }}
                    className="text-xs border-dashed border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 cursor-pointer"
                  >
                    + Register New Family Member for this Number
                  </Button>
                </div>
              </div>
            )}

            {/* Selected Patient Banner */}
            {selectedPatient && (
              <div className="flex items-center justify-between p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs text-emerald-800 dark:text-emerald-300">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
                  <span>
                    Selected Existing Patient: <strong>{selectedPatient.name}</strong> (
                    <span className="font-mono font-bold">{selectedPatient.patient_seq_id}</span>)
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedPatient(null)}
                  className="h-6 text-[11px] text-muted-foreground hover:text-foreground"
                >
                  Change Patient
                </Button>
              </div>
            )}
          </div>

          {/* Step 2: Patient & Clinical Information Fields (Configurable Rendering) */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Step 2: Patient & Consultation Details
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Patient Name */}
              {formConfig.name?.show && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">
                    Patient Name {formConfig.name?.required && <span className="text-amber-500">*</span>}
                  </Label>
                  <Input
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                    placeholder="Enter full patient name..."
                    required={formConfig.name?.required}
                    className="bg-background text-sm"
                  />
                </div>
              )}

              {/* Age */}
              {formConfig.age?.show && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">
                    Age {formConfig.age?.required && <span className="text-amber-500">*</span>}
                  </Label>
                  <Input
                    type="number"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    placeholder="e.g. 35"
                    required={formConfig.age?.required}
                    className="bg-background text-sm"
                  />
                </div>
              )}

              {/* Gender */}
              {formConfig.gender?.show && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">
                    Gender {formConfig.gender?.required && <span className="text-amber-500">*</span>}
                  </Label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    required={formConfig.gender?.required}
                    className="w-full flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">-- Select Gender --</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              )}

              {/* Date of Birth */}
              {formConfig.dob?.show && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">
                    Date of Birth {formConfig.dob?.required && <span className="text-amber-500">*</span>}
                  </Label>
                  <Input
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    required={formConfig.dob?.required}
                    className="bg-background text-sm"
                  />
                </div>
              )}

              {/* Blood Group */}
              {formConfig.blood_group?.show && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">
                    Blood Group {formConfig.blood_group?.required && <span className="text-amber-500">*</span>}
                  </Label>
                  <select
                    value={bloodGroup}
                    onChange={(e) => setBloodGroup(e.target.value)}
                    required={formConfig.blood_group?.required}
                    className="w-full flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">-- Select Blood Group --</option>
                    {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => (
                      <option key={bg} value={bg}>{bg}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Preferred Doctor */}
              {formConfig.doctor_id?.show && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">
                    Attending Doctor {formConfig.doctor_id?.required && <span className="text-amber-500">*</span>}
                  </Label>
                  <select
                    value={doctorId}
                    onChange={(e) => setDoctorId(e.target.value)}
                    required={formConfig.doctor_id?.required}
                    className="w-full flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">-- Choose Doctor --</option>
                    {doctors.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.department})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Department */}
              {formConfig.department?.show && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">
                    Clinical Department {formConfig.department?.required && <span className="text-amber-500">*</span>}
                  </Label>
                  <Input
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="e.g. Cardiology, Orthopedics, General OPD"
                    required={formConfig.department?.required}
                    className="bg-background text-sm"
                  />
                </div>
              )}

              {/* Address */}
              {formConfig.address?.show && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">
                    Address {formConfig.address?.required && <span className="text-amber-500">*</span>}
                  </Label>
                  <Input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="City / Area / Full Address"
                    required={formConfig.address?.required}
                    className="bg-background text-sm"
                  />
                </div>
              )}

              {/* Emergency Contact */}
              {formConfig.emergency_contact?.show && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">
                    Emergency Contact {formConfig.emergency_contact?.required && <span className="text-amber-500">*</span>}
                  </Label>
                  <Input
                    value={emergencyContact}
                    onChange={(e) => setEmergencyContact(e.target.value)}
                    placeholder="Contact Name & Mobile..."
                    required={formConfig.emergency_contact?.required}
                    className="bg-background text-sm"
                  />
                </div>
              )}

              {/* Date & Time (Always Visible for Appointment) */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Appointment Date *</Label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="bg-background text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Appointment Time *</Label>
                <Input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  required
                  className="bg-background text-sm"
                />
              </div>

              {/* Internal Notes */}
              {formConfig.notes?.show && (
                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-xs font-semibold">
                    Special Instructions / Triage Notes {formConfig.notes?.required && <span className="text-amber-500">*</span>}
                  </Label>
                  <Input
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Symptoms, past history, or receptionist notes..."
                    required={formConfig.notes?.required}
                    className="bg-background text-sm"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-4 border-t border-border">
            <Button type="button" variant="outline" onClick={() => setShowAddForm(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="bg-emerald-700 dark:bg-emerald-600 hover:bg-emerald-600 text-white font-bold cursor-pointer transition-all shadow-md shadow-emerald-600/10"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Booking Appointment...
                </>
              ) : (
                "Schedule & Generate Token"
              )}
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
                ? "border-emerald-500 text-emerald-600 dark:text-emerald-400 font-bold"
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
        <div className="border border-dashed border-border rounded-2xl p-12 text-center max-w-2xl mx-auto bg-card">
          <CalendarIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-bold text-foreground">No appointments found</h3>
          <p className="text-muted-foreground text-sm mt-1">There are no consultations matching this filter.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
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
                        <User className="h-4.5 w-4.5 text-emerald-500" />
                        <div>
                          <div className="text-foreground font-bold">{appt.patient?.name || "Unknown Patient"}</div>
                          <div className="text-xs text-muted-foreground font-normal">{appt.patient?.phone}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium">
                      <div className="flex items-center gap-2">
                        <UserCheck className="h-4.5 w-4.5 text-muted-foreground/70" />
                        <div>
                          <div>{appt.doctor?.name || "Unassigned"}</div>
                          <div className="text-xs text-muted-foreground font-normal">{appt.doctor?.specialization || appt.department}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-bold text-foreground/80">
                      {appt.token_number ? `#${appt.token_number} (Pos: ${appt.queue_position})` : "-"}
                    </td>
                    <td className="px-6 py-4 font-semibold text-emerald-600 dark:text-emerald-400">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-4 w-4" />
                        <span>{appt.appointment_date} at {appt.appointment_time}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                        appt.status === "confirmed"
                          ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                          : appt.status === "pending"
                          ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                          : appt.status === "calling"
                          ? "bg-blue-500/10 text-blue-500 animate-pulse border border-blue-500/20"
                          : appt.status === "completed"
                          ? "bg-indigo-500/10 text-indigo-500 border border-indigo-500/20"
                          : "bg-red-500/10 text-red-500 border border-red-500/20"
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

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          toast.info("Sending Watermarked OPD Ticket PDF to patient's WhatsApp...");
                          try {
                            const res = await fetch(`/api/appointments/${appt.id}/confirm`, { method: "POST" });
                            if (res.ok) {
                              toast.success("OPD Ticket PDF sent to patient's WhatsApp!");
                            } else {
                              const data = await res.json().catch(() => ({}));
                              toast.error(data.error || "Failed to send ticket PDF");
                            }
                          } catch (e: any) {
                            toast.error("Error sending ticket PDF: " + e.message);
                          }
                        }}
                        className="bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 text-xs py-1.5 px-2.5 font-semibold cursor-pointer"
                      >
                        Send Ticket PDF
                      </Button>

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
