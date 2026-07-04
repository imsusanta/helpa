"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Users,
  Search,
  Plus,
  Loader2,
  Calendar,
  Phone,
  Mail,
  User,
  Heart,
  AlertCircle,
  FileText,
  MessageSquare,
  Brain,
  UserCheck,
  FileDown,
  Edit,
  Activity,
  FileUp,
} from "lucide-react";
import { toast } from "sonner";

interface Patient {
  id: string;
  patient_seq_id: string;
  gender: string;
  date_of_birth: string;
  blood_group: string;
  address: string;
  emergency_contact: string;
  ai_summary: string;
  ai_notes: string;
  status: string;
  contact: { name: string; phone: string; email: string };
  doctor?: { name: string } | null;
}

interface Message {
  id: string;
  sender_type: string;
  content_text: string;
  created_at: string;
}

interface Appointment {
  id: string;
  appointment_date: string;
  appointment_time: string;
  status: string;
  token_number?: number;
  queue_position?: number;
  booking_id?: string;
  doctor: { name: string } | null;
}

export default function PatientsPage() {
  const { accountId } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [genderFilter, setGenderFilter] = useState("");

  // Detail panel state
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [timeline, setTimeline] = useState<Message[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Lab reports state
  const [labReports, setLabReports] = useState<any[]>([]);
  const [showAddReportForm, setShowAddReportForm] = useState(false);
  const [reportTestName, setReportTestName] = useState("");
  const [reportStatus, setReportStatus] = useState("pending");
  const [reportDeliveryDate, setReportDeliveryDate] = useState("");
  const [reportPdfUrl, setReportPdfUrl] = useState("");
  const [reportNotes, setReportNotes] = useState("");
  const [addingReport, setAddingReport] = useState(false);

  const [editingReportId, setEditingReportId] = useState<string | null>(null);
  const [editTestName, setEditTestName] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editDeliveryDate, setEditDeliveryDate] = useState("");
  const [editPdfUrl, setEditPdfUrl] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [savingReport, setSavingReport] = useState(false);

  // Form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [gender, setGender] = useState("Male");
  const [dob, setDob] = useState("");
  const [bloodGroup, setBloodGroup] = useState("");
  const [address, setAddress] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("");
  const [saving, setSaving] = useState(false);

  const loadPatients = useCallback(async () => {
    if (!accountId) return;
    const db = createClient();
    const { data, error } = await db
      .from("patients")
      .select("*, contact:contacts(name, phone, email), doctor:hospital_doctors(name)")
      .eq("account_id", accountId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading patients:", error);
    } else {
      setPatients((data as any) || []);
    }
    setLoading(false);
  }, [accountId]);

  useEffect(() => {
    loadPatients();
  }, [loadPatients]);

  const loadPatientDetails = async (patient: Patient) => {
    setSelectedPatient(patient);
    setLoadingDetails(true);
    const db = createClient();

    try {
      // 1. Fetch appointments
      const { data: appts } = await db
        .from("appointments")
        .select("id, appointment_date, appointment_time, status, token_number, queue_position, booking_id, doctor:hospital_doctors(name)")
        .eq("patient_id", patient.id)
        .order("appointment_date", { ascending: false });

      setAppointments((appts as any) || []);

      // 2. Fetch lab reports
      const { data: reports } = await db
        .from("hospital_lab_reports")
        .select("*")
        .eq("patient_id", patient.id)
        .order("created_at", { ascending: false });
      setLabReports(reports || []);

      // 3. Fetch recent conversation messages
      const { data: convs } = await db
        .from("conversations")
        .select("id")
        .eq("contact_id", patient.id)
        .limit(1);

      if (convs && convs.length > 0) {
        const { data: msgs } = await db
          .from("messages")
          .select("id, sender_type, content_text, created_at")
          .eq("conversation_id", convs[0].id)
          .order("created_at", { ascending: false })
          .limit(10);
        setTimeline((msgs as any) || []);
      } else {
        setTimeline([]);
      }
    } catch (err) {
      console.error("Error fetching patient details:", err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleUpdateAppointmentStatus = async (apptId: string, status: string) => {
    const db = createClient();
    const { error } = await db
      .from("appointments")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", apptId);

    if (error) {
      toast.error("Failed to update appointment status: " + error.message);
    } else {
      toast.success("Appointment status updated successfully!");
      if (selectedPatient) {
        const { data: appts } = await db
          .from("appointments")
          .select("id, appointment_date, appointment_time, status, token_number, queue_position, booking_id, doctor:hospital_doctors(name)")
          .eq("patient_id", selectedPatient.id)
          .order("appointment_date", { ascending: false });
        setAppointments((appts as any) || []);
      }
    }
  };

  const handleCreateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient || !reportTestName) return;
    setAddingReport(true);
    const db = createClient();
    try {
      const { error } = await db
        .from("hospital_lab_reports")
        .insert({
          account_id: accountId,
          patient_id: selectedPatient.id,
          test_name: reportTestName,
          status: reportStatus,
          expected_delivery_date: reportDeliveryDate || null,
          report_pdf_url: reportPdfUrl || null,
          notes: reportNotes || null,
        });

      if (error) throw error;
      toast.success("Lab report created successfully!");
      setReportTestName("");
      setReportStatus("pending");
      setReportDeliveryDate("");
      setReportPdfUrl("");
      setReportNotes("");
      setShowAddReportForm(false);
      loadPatientDetails(selectedPatient);
    } catch (err: any) {
      toast.error("Failed to create report: " + err.message);
    } finally {
      setAddingReport(false);
    }
  };

  const handleUpdateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReportId) return;
    setSavingReport(true);
    const db = createClient();
    try {
      const { error } = await db
        .from("hospital_lab_reports")
        .update({
          test_name: editTestName,
          status: editStatus,
          expected_delivery_date: editDeliveryDate || null,
          report_pdf_url: editPdfUrl || null,
          notes: editNotes || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingReportId);

      if (error) throw error;
      toast.success("Lab report updated successfully!");
      setEditingReportId(null);
      if (selectedPatient) loadPatientDetails(selectedPatient);
    } catch (err: any) {
      toast.error("Failed to update report: " + err.message);
    } finally {
      setSavingReport(false);
    }
  };

  const startEditReport = (report: any) => {
    setEditingReportId(report.id);
    setEditTestName(report.test_name);
    setEditStatus(report.status);
    setEditDeliveryDate(report.expected_delivery_date || "");
    setEditPdfUrl(report.report_pdf_url || "");
    setEditNotes(report.notes || "");
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone || !dob) {
      toast.error("Please fill in Name, Phone, and DOB.");
      return;
    }

    setSaving(true);
    const db = createClient();

    try {
      // 1. Create contact
      const { data: contact, error: contactErr } = await db
        .from("contacts")
        .insert({
          account_id: accountId,
          name,
          phone,
          email: email || null,
        })
        .select("id")
        .single();

      if (contactErr) throw contactErr;

      // 2. Create patient
      const seq = `PAT-${Date.now().toString().slice(-5)}`;
      const { error: patientErr } = await db.from("patients").insert({
        id: contact.id,
        account_id: accountId,
        patient_seq_id: seq,
        gender,
        date_of_birth: dob,
        blood_group: bloodGroup || null,
        address: address || null,
        emergency_contact: emergencyContact || null,
        status: "active",
      });

      if (patientErr) throw patientErr;

      // 3. Create active conversation row so inbox loads it correctly
      await db.from("conversations").insert({
        account_id: accountId,
        contact_id: contact.id,
        status: "open",
        last_message_text: "Registered manually via Patient CRM",
        last_message_at: new Date().toISOString(),
      });

      toast.success(`Patient registered successfully! ID: ${seq}`);
      setName("");
      setPhone("");
      setEmail("");
      setDob("");
      setBloodGroup("");
      setAddress("");
      setEmergencyContact("");
      setShowAddForm(false);
      loadPatients();
    } catch (err: any) {
      toast.error("Registration failed: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const filteredPatients = patients.filter((p) => {
    const matchSearch =
      p.contact?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.contact?.phone?.includes(searchQuery) ||
      p.patient_seq_id?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchGender = genderFilter === "" || p.gender === genderFilter;
    return matchSearch && matchGender;
  });

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* Patients List (Left Columns) */}
      <div className="lg:col-span-2 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Patients Directory</h1>
            <p className="text-sm text-muted-foreground font-medium">Manage clinical patient profiles.</p>
          </div>
          <Button onClick={() => setShowAddForm(!showAddForm)} className="cursor-pointer">
            <Plus className="h-4 w-4 mr-2" /> Register Patient
          </Button>
        </div>

        {/* Filter controls */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search patients by name, ID, or phone..."
              className="pl-9"
            />
          </div>
          <select
            value={genderFilter}
            onChange={(e) => setGenderFilter(e.target.value)}
            className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">All Genders</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
        </div>

        {/* Registration form */}
        {showAddForm && (
          <form onSubmit={handleRegister} className="bg-card border border-border rounded-xl p-5 space-y-4 animate-in fade-in slide-in-from-top-4 duration-200">
            <h3 className="font-bold text-foreground">Manually Register Patient</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Full Name *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. John Doe" required />
              </div>
              <div className="space-y-2">
                <Label>Phone Number * (with country code)</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. +15550199" required />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e.g. john@example.com" />
              </div>
              <div className="space-y-2">
                <Label>Gender</Label>
                <select value={gender} onChange={(e) => setGender(e.target.value)} className="w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Date of Birth *</Label>
                <Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Blood Group</Label>
                <Input value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)} placeholder="e.g. O+, AB-" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Emergency Contact (Name & Phone)</Label>
                <Input value={emergencyContact} onChange={(e) => setEmergencyContact(e.target.value)} placeholder="e.g. Jane Doe (+15550188)" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Home Address</Label>
                <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="e.g. 123 Health Way, Sector 4" />
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button type="button" variant="outline" onClick={() => setShowAddForm(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Register Patient
              </Button>
            </div>
          </form>
        )}

        {/* Patient Table */}
        {filteredPatients.length === 0 ? (
          <div className="border border-dashed border-border rounded-xl p-12 text-center">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-bold text-foreground">No patients found</h3>
            <p className="text-muted-foreground text-sm mt-1">Try refining your filters or register a new profile.</p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm text-left text-muted-foreground">
              <thead className="text-xs uppercase bg-muted/50 border-b border-border text-foreground font-semibold">
                <tr>
                  <th className="px-6 py-4">ID</th>
                  <th className="px-6 py-4">Name</th>
                  <th className="px-6 py-4">Gender / Age</th>
                  <th className="px-6 py-4">Blood Group</th>
                  <th className="px-6 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-foreground">
                {filteredPatients.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => loadPatientDetails(p)}
                    className={`hover:bg-muted/30 transition-colors cursor-pointer ${
                      selectedPatient?.id === p.id ? "bg-primary/5" : ""
                    }`}
                  >
                    <td className="px-6 py-4 font-bold text-primary">{p.patient_seq_id}</td>
                    <td className="px-6 py-4 font-semibold">
                      <div>{p.contact?.name || "Unknown"}</div>
                      <div className="text-xs text-muted-foreground font-normal">{p.contact?.phone}</div>
                    </td>
                    <td className="px-6 py-4 text-xs font-medium">
                      {p.gender} / {p.date_of_birth ? `${new Date().getFullYear() - new Date(p.date_of_birth).getFullYear()} yrs` : "N/A"}
                    </td>
                    <td className="px-6 py-4 font-bold text-red-500">{p.blood_group || "-"}</td>
                    <td className="px-6 py-4">
                      <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500">
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Patient Detail Panel (Right Column) */}
      <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-6">
        {selectedPatient ? (
          <>
            <div>
              <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded uppercase tracking-wider">
                {selectedPatient.patient_seq_id}
              </span>
              <h2 className="text-xl font-extrabold text-foreground mt-2">
                {selectedPatient.contact?.name || "Unknown Patient"}
              </h2>
            </div>

            {/* Tabs details */}
            <div className="space-y-4 text-sm">
              <h4 className="font-bold text-foreground border-b border-border pb-1">Patient Details</h4>
              <div className="space-y-2.5">
                <p className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-4 w-4 text-muted-foreground/60 shrink-0" />
                  <span className="text-foreground">{selectedPatient.contact?.phone}</span>
                </p>
                {selectedPatient.contact?.email && (
                  <p className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-4 w-4 text-muted-foreground/60 shrink-0" />
                    <span className="text-foreground truncate">{selectedPatient.contact.email}</span>
                  </p>
                )}
                <p className="flex items-center gap-2 text-muted-foreground">
                  <User className="h-4 w-4 text-muted-foreground/60 shrink-0" />
                  <span>DOB: <span className="text-foreground">{selectedPatient.date_of_birth || "N/A"}</span></span>
                </p>
                <p className="flex items-center gap-2 text-muted-foreground">
                  <Heart className="h-4 w-4 text-muted-foreground/60 shrink-0" />
                  <span>Blood Group: <span className="text-foreground font-bold text-red-500">{selectedPatient.blood_group || "N/A"}</span></span>
                </p>
                {selectedPatient.doctor?.name && (
                  <p className="flex items-center gap-2 text-muted-foreground">
                    <UserCheck className="h-4 w-4 text-muted-foreground/60 shrink-0" />
                    <span>Preferred Doctor: <span className="text-foreground">{selectedPatient.doctor.name}</span></span>
                  </p>
                )}
                {selectedPatient.emergency_contact && (
                  <p className="flex items-center gap-2 text-muted-foreground">
                    <AlertCircle className="h-4 w-4 text-muted-foreground/60 shrink-0" />
                    <span>ICE: <span className="text-foreground">{selectedPatient.emergency_contact}</span></span>
                  </p>
                )}
              </div>

              {/* AI summary */}
              {selectedPatient.ai_summary && (
                <div className="bg-primary/5 rounded-lg p-3 space-y-1">
                  <p className="font-bold text-primary text-xs flex items-center gap-1">
                    <Brain className="h-3.5 w-3.5" /> AI Conversation Summary
                  </p>
                  <p className="text-xs text-muted-foreground leading-normal">
                    {selectedPatient.ai_summary}
                  </p>
                </div>
              )}

              {/* Internal Notes */}
              {selectedPatient.ai_notes && (
                <div className="bg-amber-500/5 rounded-lg p-3 space-y-1">
                  <p className="font-bold text-amber-600 dark:text-amber-400 text-xs flex items-center gap-1">
                    <FileText className="h-3.5 w-3.5" /> Internal Notes
                  </p>
                  <p className="text-xs text-muted-foreground leading-normal">
                    {selectedPatient.ai_notes}
                  </p>
                </div>
              )}

              {/* Appointment history */}
              <div className="space-y-2">
                <h4 className="font-bold text-foreground border-b border-border pb-1">Appointment History</h4>
                {loadingDetails ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : appointments.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No appointment bookings logged.</p>
                ) : (
                  <div className="space-y-2">
                    {appointments.map((appt) => (
                      <div key={appt.id} className="border border-border rounded-lg p-2.5 text-xs bg-muted/20 space-y-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-bold text-foreground">
                              {appt.doctor?.name || "General consult"}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {new Date(appt.appointment_date).toLocaleDateString()} at {appt.appointment_time}
                            </p>
                          </div>
                          <select
                            value={appt.status}
                            onChange={(e) => handleUpdateAppointmentStatus(appt.id, e.target.value)}
                            className="text-[9px] font-extrabold uppercase bg-background border border-border rounded px-1 py-0.5 text-foreground cursor-pointer focus:outline-none"
                          >
                            <option value="pending">Pending</option>
                            <option value="confirmed">Confirmed</option>
                            <option value="checked_in">Checked In</option>
                            <option value="waiting">Waiting</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        </div>
                        <div className="grid grid-cols-3 gap-1 text-[9px] text-muted-foreground bg-background/40 p-1.5 rounded">
                          <div>
                            <span className="block font-bold">Booking ID</span>
                            <span className="text-foreground font-semibold uppercase">{appt.booking_id || `APT-${appt.id.slice(0, 5)}`}</span>
                          </div>
                          <div>
                            <span className="block font-bold">Token</span>
                            <span className="text-foreground font-semibold">#{appt.token_number || 1}</span>
                          </div>
                          <div>
                            <span className="block font-bold">Queue Pos</span>
                            <span className="text-foreground font-semibold">{appt.queue_position || 1}</span>
                          </div>
                        </div>
                        <div className="flex justify-end pt-1">
                          <a
                            href={`/api/appointments/${appt.id}/pdf`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline font-bold"
                          >
                            <FileDown className="h-3 w-3" /> Download Slip PDF
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Lab Reports Module */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-border pb-1">
                  <h4 className="font-bold text-foreground">Lab Reports</h4>
                  <Button
                    size="xs"
                    variant="ghost"
                    className="h-6 text-[10px] text-primary font-bold hover:text-primary/80"
                    onClick={() => setShowAddReportForm(!showAddReportForm)}
                  >
                    <Plus className="h-3 w-3 mr-1" /> Add Report
                  </Button>
                </div>

                {showAddReportForm && (
                  <form onSubmit={handleCreateReport} className="border border-border/80 rounded-lg p-3 space-y-2.5 bg-muted/10">
                    <p className="text-[10px] font-bold uppercase text-muted-foreground">New Report</p>
                    <div className="space-y-1">
                      <Label htmlFor="rep-name" className="text-[10px]">Test Name *</Label>
                      <Input
                        id="rep-name"
                        value={reportTestName}
                        onChange={(e) => setReportTestName(e.target.value)}
                        placeholder="e.g. Complete Blood Count"
                        className="h-7 text-xs px-2"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label htmlFor="rep-status" className="text-[10px]">Status</Label>
                        <select
                          id="rep-status"
                          value={reportStatus}
                          onChange={(e) => setReportStatus(e.target.value)}
                          className="w-full text-xs h-7 border border-input rounded-md px-1.5 bg-background"
                        >
                          <option value="pending">Pending</option>
                          <option value="processing">Processing</option>
                          <option value="ready">Ready</option>
                          <option value="delivered">Delivered</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="rep-date" className="text-[10px]">Expected Date</Label>
                        <Input
                          id="rep-date"
                          type="date"
                          value={reportDeliveryDate}
                          onChange={(e) => setReportDeliveryDate(e.target.value)}
                          className="h-7 text-xs px-2"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="rep-pdf" className="text-[10px]">Report PDF URL (optional)</Label>
                      <Input
                        id="rep-pdf"
                        value={reportPdfUrl}
                        onChange={(e) => setReportPdfUrl(e.target.value)}
                        placeholder="https://example.com/report.pdf"
                        className="h-7 text-xs px-2"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="rep-notes" className="text-[10px]">Internal Notes</Label>
                      <Input
                        id="rep-notes"
                        value={reportNotes}
                        onChange={(e) => setReportNotes(e.target.value)}
                        placeholder="Additional observations..."
                        className="h-7 text-xs px-2"
                      />
                    </div>
                    <div className="flex gap-2 justify-end pt-1">
                      <Button type="button" size="xs" variant="outline" onClick={() => setShowAddReportForm(false)}>Cancel</Button>
                      <Button type="submit" size="xs" disabled={addingReport}>
                        {addingReport ? "Creating..." : "Save Report"}
                      </Button>
                    </div>
                  </form>
                )}

                {/* Edit Report Form */}
                {editingReportId && (
                  <form onSubmit={handleUpdateReport} className="border border-primary/20 rounded-lg p-3 space-y-2.5 bg-primary/5">
                    <p className="text-[10px] font-bold uppercase text-primary">Edit Report Details</p>
                    <div className="space-y-1">
                      <Label htmlFor="edit-rep-name" className="text-[10px]">Test Name *</Label>
                      <Input
                        id="edit-rep-name"
                        value={editTestName}
                        onChange={(e) => setEditTestName(e.target.value)}
                        className="h-7 text-xs px-2"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label htmlFor="edit-rep-status" className="text-[10px]">Status</Label>
                        <select
                          id="edit-rep-status"
                          value={editStatus}
                          onChange={(e) => setEditStatus(e.target.value)}
                          className="w-full text-xs h-7 border border-input rounded-md px-1.5 bg-background"
                        >
                          <option value="pending">Pending</option>
                          <option value="processing">Processing</option>
                          <option value="ready">Ready</option>
                          <option value="delivered">Delivered</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="edit-rep-date" className="text-[10px]">Expected Date</Label>
                        <Input
                          id="edit-rep-date"
                          type="date"
                          value={editDeliveryDate}
                          onChange={(e) => setEditDeliveryDate(e.target.value)}
                          className="h-7 text-xs px-2"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="edit-rep-pdf" className="text-[10px]">Report PDF URL</Label>
                      <Input
                        id="edit-rep-pdf"
                        value={editPdfUrl}
                        onChange={(e) => setEditPdfUrl(e.target.value)}
                        className="h-7 text-xs px-2"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="edit-rep-notes" className="text-[10px]">Internal Notes</Label>
                      <Input
                        id="edit-rep-notes"
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        className="h-7 text-xs px-2"
                      />
                    </div>
                    <div className="flex gap-2 justify-end pt-1">
                      <Button type="button" size="xs" variant="outline" onClick={() => setEditingReportId(null)}>Cancel</Button>
                      <Button type="submit" size="xs" disabled={savingReport}>
                        {savingReport ? "Saving..." : "Update Report"}
                      </Button>
                    </div>
                  </form>
                )}

                {loadingDetails ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : labReports.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No reports generated for this patient.</p>
                ) : (
                  <div className="space-y-2">
                    {labReports.map((rep) => (
                      <div key={rep.id} className="border border-border rounded-lg p-2.5 text-xs bg-muted/20 space-y-1.5">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-bold text-foreground">{rep.test_name}</p>
                            {rep.expected_delivery_date && (
                              <p className="text-[9px] text-muted-foreground">
                                Expected: {new Date(rep.expected_delivery_date).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                              rep.status === 'ready'
                                ? "bg-emerald-500/10 text-emerald-500"
                                : rep.status === 'processing'
                                ? "bg-sky-500/10 text-sky-500"
                                : rep.status === 'delivered'
                                ? "bg-slate-500/10 text-slate-400"
                                : "bg-amber-500/10 text-amber-500"
                            }`}>
                              {rep.status}
                            </span>
                            <button
                              onClick={() => startEditReport(rep)}
                              className="text-muted-foreground hover:text-foreground shrink-0"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                        {rep.notes && (
                          <p className="text-[10px] text-muted-foreground bg-background/30 p-1.5 rounded border border-border/20 leading-relaxed italic">
                            "{rep.notes}"
                          </p>
                        )}
                        {rep.report_pdf_url && (
                          <div className="flex justify-end pt-0.5">
                            <a
                              href={rep.report_pdf_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline font-bold"
                            >
                              <FileUp className="h-3 w-3" /> View Report PDF
                            </a>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent WhatsApp chat timeline */}
              <div className="space-y-2">
                <h4 className="font-bold text-foreground border-b border-border pb-1">Recent Timeline</h4>
                {loadingDetails ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : timeline.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No message exchanges logged.</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {timeline.map((msg) => (
                      <div key={msg.id} className={`p-2 rounded text-xs ${
                        msg.sender_type === "customer" ? "bg-muted text-foreground" : "bg-primary/5 border border-primary/10 text-foreground"
                      }`}>
                        <div className="flex justify-between font-semibold text-[10px] text-muted-foreground mb-1">
                          <span>{msg.sender_type === "customer" ? "Patient" : "AI Replier"}</span>
                          <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <p>{msg.content_text}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-20 text-muted-foreground">
            <Users className="h-10 w-10 mb-2 text-muted-foreground/50" />
            <p className="text-sm">Select a patient from the directory list to display records.</p>
          </div>
        )}
      </div>

    </div>
  );
}
