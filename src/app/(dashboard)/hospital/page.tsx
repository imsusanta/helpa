"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { 
  Activity, Calendar, Users, DollarSign, Sparkles, MapPin, 
  UserPlus, FileText, CheckCircle, AlertCircle, Clock, Trash2,
  Plus, Edit2, ShieldAlert, ArrowRight, Star, HeartHandshake, PhoneCall,
  Loader2, Hospital
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type TabKey = "overview" | "patients" | "appointments" | "doctors" | "lab-reports" | "billing" | "branches";

export default function HospitalPage() {
  const { user, accountId, enabledModules, canEditSettings } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [loading, setLoading] = useState(true);

  // Database States
  const [branches, setBranches] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [labReports, setLabReports] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [feedbacks, setFeedbacks] = useState<any[]>([]);

  // Dialog / Form States
  const [showAddBranch, setShowAddBranch] = useState(false);
  const [showAddDoctor, setShowAddDoctor] = useState(false);
  const [showAddPatient, setShowAddPatient] = useState(false);
  const [showAddAppointment, setShowAddAppointment] = useState(false);
  const [showAddReport, setShowAddReport] = useState(false);
  const [showAddInvoice, setShowAddInvoice] = useState(false);

  // Form Fields
  const [newBranch, setNewBranch] = useState({ name: "", address: "", phone: "" });
  const [newDoctor, setNewDoctor] = useState({ name: "", department: "General Medicine", specialization: "", consultation_fee: "50", branch_id: "", available_days: [] as string[], start_time: "09:00", end_time: "17:00" });
  const [newPatient, setNewPatient] = useState({ phone: "", name: "", email: "", gender: "Male", date_of_birth: "", blood_group: "O+", address: "", emergency_contact: "" });
  const [newAppt, setNewAppt] = useState({ patient_id: "", doctor_id: "", department: "General Medicine", date: "", time: "", branch_id: "", notes: "" });
  const [newReport, setNewReport] = useState({ patient_id: "", test_name: "", result_summary: "", file_url: "" });
  const [newInvoice, setNewInvoice] = useState({ patient_id: "", appointment_id: "", amount: "", due_date: "" });

  const supabase = createClient();
  const isHospitalEnabled = enabledModules.includes("hospital_clinic");

  // Load All Hospital Data
  async function loadData() {
    if (!accountId || !isHospitalEnabled) return;
    setLoading(true);
    try {
      const [bRes, dRes, pRes, aRes, lrRes, iRes, fRes] = await Promise.all([
        supabase.from("hospital_branches").select("*").eq("account_id", accountId),
        supabase.from("hospital_doctors").select("*").eq("account_id", accountId),
        supabase.from("patients").select("*, contact:contacts(*)").eq("account_id", accountId),
        supabase.from("appointments").select("*, patient:contacts(*), doctor:hospital_doctors(*)").eq("account_id", accountId),
        supabase.from("lab_reports").select("*, patient:contacts(*)").eq("account_id", accountId),
        supabase.from("billing_invoices").select("*, patient:contacts(*)").eq("account_id", accountId),
        supabase.from("appointments_feedback").select("*, patient:contacts(*)").eq("account_id", accountId),
      ]);

      setBranches(bRes.data || []);
      setDoctors(dRes.data || []);
      setPatients(pRes.data || []);
      setAppointments(aRes.data || []);
      setLabReports(lrRes.data || []);
      setInvoices(iRes.data || []);
      setFeedbacks(fRes.data || []);
    } catch (err) {
      console.error("Failed to load hospital workspace:", err);
      toast.error("Error loading hospital workspace data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isHospitalEnabled) {
      loadData();
    } else {
      setLoading(false);
    }
  }, [accountId, isHospitalEnabled]);

  // Seeding initial branch/doctor for testing ease
  const handleQuickSeed = async () => {
    if (!accountId) return;
    try {
      // 1. Seed Branch
      const { data: brData } = await supabase.from("hospital_branches").insert({
        account_id: accountId,
        name: "Main City Hospital",
        address: "78 Healthcare Ave, Central Branch",
        phone: "+15550199"
      }).select().single();

      if (brData) {
        // 2. Seed Doctors
        await supabase.from("hospital_doctors").insert([
          {
            account_id: accountId,
            branch_id: brData.id,
            name: "Dr. Elizabeth Vance",
            department: "Cardiology",
            specialization: "Heart Specialist",
            consultation_fee: 15000, // $150
            available_days: ["Monday", "Wednesday", "Friday"],
            working_hours: { start: "09:00", end: "16:00" }
          },
          {
            account_id: accountId,
            branch_id: brData.id,
            name: "Dr. Gordon Freeman",
            department: "General Medicine",
            specialization: "General Physician",
            consultation_fee: 8000, // $80
            available_days: ["Tuesday", "Thursday"],
            working_hours: { start: "10:00", end: "17:00" }
          }
        ]);
      }
      toast.success("Hospital branches & doctors seeded successfully!");
      loadData();
    } catch (err) {
      toast.error("Seeding failed");
    }
  };

  // Add Branch
  const handleAddBranchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBranch.name.trim()) return;
    try {
      const { error } = await supabase.from("hospital_branches").insert({
        account_id: accountId,
        name: newBranch.name,
        address: newBranch.address,
        phone: newBranch.phone,
      });
      if (error) throw error;
      toast.success("Branch added successfully");
      setShowAddBranch(false);
      setNewBranch({ name: "", address: "", phone: "" });
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to add branch");
    }
  };

  // Add Doctor
  const handleAddDoctorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDoctor.name.trim()) return;
    try {
      const { error } = await supabase.from("hospital_doctors").insert({
        account_id: accountId,
        branch_id: newDoctor.branch_id || null,
        name: newDoctor.name,
        department: newDoctor.department,
        specialization: newDoctor.specialization,
        consultation_fee: parseFloat(newDoctor.consultation_fee) * 100, // convert to cents
        available_days: newDoctor.available_days.length > 0 ? newDoctor.available_days : ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        working_hours: { start: newDoctor.start_time, end: newDoctor.end_time },
      });
      if (error) throw error;
      toast.success("Doctor added successfully");
      setShowAddDoctor(false);
      setNewDoctor({ name: "", department: "General Medicine", specialization: "", consultation_fee: "50", branch_id: "", available_days: [], start_time: "09:00", end_time: "17:00" });
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to add doctor");
    }
  };

  // Add Patient (Create Contact if not exists + Link Patient)
  const handleAddPatientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPatient.phone.trim() || !newPatient.name.trim()) return;
    try {
      // 1. Check or create contact
      let contactId = "";
      const { data: extContact } = await supabase
        .from("contacts")
        .select("id")
        .eq("phone", newPatient.phone)
        .eq("account_id", accountId)
        .maybeSingle();

      if (extContact) {
        contactId = extContact.id;
      } else {
        const { data: newContact, error: cErr } = await supabase
          .from("contacts")
          .insert({
            account_id: accountId,
            user_id: user?.id,
            phone: newPatient.phone,
            name: newPatient.name,
            email: newPatient.email || null,
          })
          .select()
          .single();
        if (cErr) throw cErr;
        contactId = newContact.id;
      }

      // 2. Generate friendly Patient Seq ID
      const seq = `PAT-${Date.now().toString().slice(-5)}`;

      // 3. Create patient record
      const { error: pErr } = await supabase.from("patients").insert({
        id: contactId,
        account_id: accountId,
        patient_seq_id: seq,
        gender: newPatient.gender,
        date_of_birth: newPatient.date_of_birth || null,
        blood_group: newPatient.blood_group,
        address: newPatient.address,
        emergency_contact: newPatient.emergency_contact,
        status: "active",
      });

      if (pErr) throw pErr;
      toast.success(`Patient profile ${seq} registered successfully!`);
      setShowAddPatient(false);
      setNewPatient({ phone: "", name: "", email: "", gender: "Male", date_of_birth: "", blood_group: "O+", address: "", emergency_contact: "" });
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to register patient");
    }
  };

  // Add Appointment
  const handleAddAppointmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAppt.patient_id || !newAppt.date || !newAppt.time) return;
    try {
      const { error } = await supabase.from("appointments").insert({
        account_id: accountId,
        patient_id: newAppt.patient_id,
        doctor_id: newAppt.doctor_id || null,
        department: newAppt.department,
        appointment_date: newAppt.date,
        appointment_time: newAppt.time,
        branch_id: newAppt.branch_id || null,
        notes: newAppt.notes,
        status: "pending",
      });
      if (error) throw error;
      toast.success("Appointment booked successfully!");
      setShowAddAppointment(false);
      setNewAppt({ patient_id: "", doctor_id: "", department: "General Medicine", date: "", time: "", branch_id: "", notes: "" });
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to book appointment");
    }
  };

  // Add Lab Report
  const handleAddReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReport.patient_id || !newReport.test_name.trim()) return;
    try {
      const { error } = await supabase.from("lab_reports").insert({
        account_id: accountId,
        patient_id: newReport.patient_id,
        test_name: newReport.test_name,
        result_summary: newReport.result_summary,
        file_url: newReport.file_url,
        status: "pending",
      });
      if (error) throw error;
      toast.success("Lab report test ordered!");
      setShowAddReport(false);
      setNewReport({ patient_id: "", test_name: "", result_summary: "", file_url: "" });
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to book lab test");
    }
  };

  // Add Invoice
  const handleAddInvoiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInvoice.patient_id || !newInvoice.amount.trim()) return;
    try {
      const num = `INV-${Date.now().toString().slice(-6)}`;
      const { error } = await supabase.from("billing_invoices").insert({
        account_id: accountId,
        patient_id: newInvoice.patient_id,
        appointment_id: newInvoice.appointment_id || null,
        invoice_number: num,
        amount: parseFloat(newInvoice.amount) * 100, // convert to cents
        due_date: newInvoice.due_date || null,
        status: "unpaid",
      });
      if (error) throw error;
      toast.success(`Invoice ${num} generated!`);
      setShowAddInvoice(false);
      setNewInvoice({ patient_id: "", appointment_id: "", amount: "", due_date: "" });
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to create invoice");
    }
  };

  // Toggle Appointment Status (e.g. mark completed -> triggers review flow)
  const handleUpdateApptStatus = async (id: string, currentStatus: string, nextStatus: string) => {
    try {
      const { error } = await supabase
        .from("appointments")
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      toast.success(`Appointment status updated to ${nextStatus}`);

      // If marked completed, trigger review request API mock
      if (nextStatus === "completed") {
        toast.info("Appointment completed. Triggering WhatsApp Feedback request...");
        // Call feedback endpoint
        fetch("/api/whatsapp/broadcast", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "feedback",
            appointmentId: id,
          }),
        }).catch(err => console.error("Feedback dispatch fail", err));
      }
      loadData();
    } catch (err: any) {
      toast.error("Failed to update appointment status");
    }
  };

  // Toggle Lab Report Status (mark ready -> triggers ready notification)
  const handleMarkReportReady = async (id: string) => {
    try {
      const { error } = await supabase
        .from("lab_reports")
        .update({ 
          status: "ready", 
          ready_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq("id", id);
      if (error) throw error;
      toast.success("Lab report marked Ready!");
      toast.info("Triggering patient WhatsApp report ready alert...");

      // Simulate webhook push for lab report ready
      fetch("/api/whatsapp/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "lab_ready",
          reportId: id,
        }),
      }).catch(err => console.error("Lab ready notification dispatch fail", err));

      loadData();
    } catch (err) {
      toast.error("Failed to update report status");
    }
  };

  // Send Billing WhatsApp Reminder
  const handleSendBillReminder = async (id: string) => {
    try {
      toast.info("Sending payment reminder on WhatsApp...");
      const res = await fetch("/api/whatsapp/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "billing_reminder",
          invoiceId: id,
        }),
      });
      toast.success("Payment reminder message dispatched successfully!");
    } catch (err) {
      toast.error("Failed to send reminder");
    }
  };

  // Overview metrics calculations
  const metrics = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const todayAppts = appointments.filter(a => a.appointment_date === today);
    const pendingAppts = appointments.filter(a => a.status === "pending");
    const completedAppts = appointments.filter(a => a.status === "completed");
    const unpaidBills = invoices.filter(i => i.status === "unpaid");
    const totalOutstanding = unpaidBills.reduce((acc, curr) => acc + (curr.amount / 100), 0);
    
    // Revenue is paid invoices
    const revenue = invoices
      .filter(i => i.status === "paid")
      .reduce((acc, curr) => acc + (curr.amount / 100), 0);
      
    const readyReports = labReports.filter(r => r.status === "ready");
    const totalPatientsToday = patients.length; // mock active patients size

    return {
      todayApptsCount: todayAppts.length,
      pendingApptsCount: pendingAppts.length,
      completedApptsCount: completedAppts.length,
      outstandingAmount: totalOutstanding,
      revenueAmount: revenue,
      readyReportsCount: readyReports.length,
      patientsCount: totalPatientsToday
    };
  }, [appointments, invoices, labReports, patients]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground font-medium">Loading Hospital Workspace...</p>
        </div>
      </div>
    );
  }

  // Gate check
  if (!isHospitalEnabled) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center p-6 text-center animate-in fade-in-50 duration-200">
        <div className="flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary mb-4">
          <Hospital className="h-8 w-8" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Hospital & Clinic CRM Module</h2>
        <p className="max-w-md text-sm text-muted-foreground mt-2 leading-relaxed">
          The Hospital & Clinic management workspace is currently disabled for this tenant account. Turn on this package under your workspace configurations to get access.
        </p>
        {canEditSettings ? (
          <Button onClick={() => router.push("/settings?tab=modules")} className="mt-6 gap-2">
            Go to Feature Modules
            <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <p className="text-xs text-amber-500 font-medium mt-4">
            * Please ask your workspace administrator to enable this module.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Hospital className="h-6 w-6 text-primary" />
            Hospital & Clinic Management
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage your patient CRM, bookings, doctor schedules, test results, and billing campaigns.
          </p>
        </div>
        <div className="flex gap-2">
          {branches.length === 0 && (
            <Button variant="outline" size="sm" onClick={handleQuickSeed} className="gap-1.5 border-primary/20 text-primary hover:bg-primary/5">
              <Sparkles className="h-4 w-4" />
              Quick Seed Demo Data
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={loadData} className="text-xs">
            Refresh Data
          </Button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-border/80 flex flex-wrap gap-1">
        {(["overview", "patients", "appointments", "doctors", "lab-reports", "billing", "branches"] as TabKey[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`border-b-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
              activeTab === tab
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            }`}
          >
            {tab.replace("-", " ")}
          </button>
        ))}
      </div>

      {/* TAB CONTENT: OVERVIEW */}
      {activeTab === "overview" && (
        <div className="space-y-6 animate-in fade-in-30">
          {/* Summary stats grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border border-border">
              <CardContent className="flex items-center gap-4 p-5">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
                  <Calendar className="size-5" />
                </span>
                <div>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Today&apos;s Appointments</span>
                  <span className="text-2xl font-bold text-foreground">{metrics.todayApptsCount}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border">
              <CardContent className="flex items-center gap-4 p-5">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
                  <Users className="size-5" />
                </span>
                <div>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Total Patients</span>
                  <span className="text-2xl font-bold text-foreground">{metrics.patientsCount}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border">
              <CardContent className="flex items-center gap-4 p-5">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 text-purple-500">
                  <FileText className="size-5" />
                </span>
                <div>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Reports Ready</span>
                  <span className="text-2xl font-bold text-foreground">{metrics.readyReportsCount}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border">
              <CardContent className="flex items-center gap-4 p-5">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
                  <DollarSign className="size-5" />
                </span>
                <div>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Total Revenue</span>
                  <span className="text-2xl font-bold text-foreground">${metrics.revenueAmount}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Today's Appt Schedule */}
            <Card className="lg:col-span-2 border border-border">
              <CardHeader className="p-5 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold">Today&apos;s Bookings</CardTitle>
                  <CardDescription className="text-xs">Incoming and scheduled patient appointments.</CardDescription>
                </div>
                <Button size="xs" onClick={() => setActiveTab("appointments")} className="text-xs">
                  View Calendar
                </Button>
              </CardHeader>
              <CardContent className="px-5 pb-5 pt-0">
                {appointments.filter(a => a.status === "pending" || a.status === "confirmed").length === 0 ? (
                  <p className="text-xs text-muted-foreground py-6 text-center">No active bookings scheduled for today.</p>
                ) : (
                  <div className="divide-y divide-border">
                    {appointments.map((appt) => (
                      <div key={appt.id} className="flex justify-between items-center py-3">
                        <div className="space-y-0.5">
                          <p className="text-sm font-semibold text-foreground">{appt.patient?.name || "Unknown Patient"}</p>
                          <p className="text-xs text-muted-foreground">{appt.doctor?.name} ({appt.department})</p>
                        </div>
                        <div className="text-right space-y-1">
                          <p className="text-xs font-semibold text-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            {appt.appointment_time.slice(0, 5)}
                          </p>
                          <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold border capitalize ${
                            appt.status === "confirmed" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-blue-500/10 text-blue-500 border-blue-500/20"
                          }`}>
                            {appt.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* AI Assistant Analytics Card */}
            <Card className="border border-border">
              <CardHeader className="p-5">
                <CardTitle className="text-sm font-bold flex items-center gap-1.5 text-primary">
                  <Sparkles className="h-4 w-4" />
                  Clinical AI Assistant
                </CardTitle>
                <CardDescription className="text-xs">AI automation performance stats</CardDescription>
              </CardHeader>
              <CardContent className="p-5 pt-0 space-y-4">
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold text-foreground">
                    <span>AI Automated Resolution</span>
                    <span>89%</span>
                  </div>
                  <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: "89%" }}></div>
                  </div>
                </div>

                <div className="border-t border-border pt-3 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Patients Registered by AI:</span>
                    <span className="font-bold text-foreground">
                      {patients.filter(p => p.ai_summary).length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Appts booked by AI:</span>
                    <span className="font-bold text-foreground">
                      {appointments.length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">OpenRouter Model in Use:</span>
                    <span className="font-mono text-foreground text-[10px]">Gemini 2.5 Flash</span>
                  </div>
                </div>

                <div className="rounded-lg bg-primary/5 border border-primary/10 p-3 space-y-1.5">
                  <p className="text-xs font-semibold text-primary flex items-center gap-1">
                    <CheckCircle className="h-3.5 w-3.5" />
                    Auto-alerts Status: Active
                  </p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Patients are automatically notified via WhatsApp once lab reports are uploaded and invoice due reminders are scheduled.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* TAB CONTENT: PATIENTS */}
      {activeTab === "patients" && (
        <div className="space-y-4 animate-in fade-in-30">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Patient Directory</h3>
            <Button size="xs" onClick={() => setShowAddPatient(true)} className="gap-1">
              <UserPlus className="h-3.5 w-3.5" />
              Register Patient
            </Button>
          </div>

          {/* Add Patient Dialog */}
          {showAddPatient && (
            <Card className="border border-primary/20 bg-muted/20">
              <CardHeader className="p-4">
                <CardTitle className="text-sm font-bold">New Patient Enrollment</CardTitle>
                <CardDescription className="text-xs">Manually enroll a new patient. AI collects these fields automatically on WhatsApp.</CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <form onSubmit={handleAddPatientSubmit} className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="p-name">Patient Name</Label>
                    <Input id="p-name"  required value={newPatient.name} onChange={(e) => setNewPatient({...newPatient, name: e.target.value})} placeholder="e.g. John Doe" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="p-phone">Phone Number (E164)</Label>
                    <Input id="p-phone"  required value={newPatient.phone} onChange={(e) => setNewPatient({...newPatient, phone: e.target.value})} placeholder="e.g. +8801700000000" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="p-email">Email</Label>
                    <Input id="p-email"  type="email" value={newPatient.email} onChange={(e) => setNewPatient({...newPatient, email: e.target.value})} placeholder="e.g. john@example.com" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="p-gender">Gender</Label>
                    <select id="p-gender" className="w-full text-xs h-8 border border-input rounded-md px-2 bg-background" value={newPatient.gender} onChange={(e) => setNewPatient({...newPatient, gender: e.target.value})}>
                      <option>Male</option>
                      <option>Female</option>
                      <option>Other</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="p-dob">Date of Birth</Label>
                    <Input id="p-dob"  type="date" value={newPatient.date_of_birth} onChange={(e) => setNewPatient({...newPatient, date_of_birth: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="p-bg">Blood Group</Label>
                    <Input id="p-bg"  value={newPatient.blood_group} onChange={(e) => setNewPatient({...newPatient, blood_group: e.target.value})} placeholder="e.g. O+" />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label htmlFor="p-addr">Address</Label>
                    <Input id="p-addr"  value={newPatient.address} onChange={(e) => setNewPatient({...newPatient, address: e.target.value})} placeholder="Full address" />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label htmlFor="p-ec">Emergency Contact</Label>
                    <Input id="p-ec"  value={newPatient.emergency_contact} onChange={(e) => setNewPatient({...newPatient, emergency_contact: e.target.value})} placeholder="e.g. Jane Doe (Wife) +15550188" />
                  </div>
                  <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
                    <Button type="button" variant="ghost" size="xs" onClick={() => setShowAddPatient(false)}>Cancel</Button>
                    <Button type="submit" size="xs">Enroll Patient</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Patient Grid */}
          {patients.length === 0 ? (
            <div className="text-center py-8 text-xs text-muted-foreground border border-dashed rounded-lg">No patient files found. Add or text a lead on WhatsApp to register them.</div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {patients.map((pat) => (
                <Card key={pat.id} className="border border-border bg-card p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-bold text-primary uppercase tracking-wider block">{pat.patient_seq_id}</span>
                      <h4 className="text-sm font-semibold text-foreground">{pat.contact?.name || "Registered Patient"}</h4>
                    </div>
                    <span className="text-[10px] font-bold bg-muted px-2 py-0.5 rounded capitalize">{pat.gender}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground border-t border-border/50 pt-2">
                    <div>
                      <span className="block text-[9px] uppercase font-semibold">Phone</span>
                      <span className="text-foreground font-medium">{pat.contact?.phone}</span>
                    </div>
                    {pat.date_of_birth && (
                      <div>
                        <span className="block text-[9px] uppercase font-semibold">DOB</span>
                        <span className="text-foreground font-medium">{pat.date_of_birth}</span>
                      </div>
                    )}
                    {pat.blood_group && (
                      <div>
                        <span className="block text-[9px] uppercase font-semibold">Blood</span>
                        <span className="text-foreground font-medium">{pat.blood_group}</span>
                      </div>
                    )}
                    {pat.emergency_contact && (
                      <div className="col-span-2">
                        <span className="block text-[9px] uppercase font-semibold">Emergency</span>
                        <span className="text-foreground font-medium leading-snug">{pat.emergency_contact}</span>
                      </div>
                    )}
                  </div>

                  {pat.ai_summary && (
                    <div className="rounded bg-primary/5 p-2 text-xs space-y-1 border border-primary/5">
                      <span className="font-semibold text-primary text-[10px] uppercase flex items-center gap-1">
                        <Sparkles className="h-3 w-3" />
                        AI Summary
                      </span>
                      <p className="text-foreground leading-relaxed">{pat.ai_summary}</p>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: APPOINTMENTS */}
      {activeTab === "appointments" && (
        <div className="space-y-4 animate-in fade-in-30">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Appointment Bookings</h3>
            <Button size="xs" onClick={() => setShowAddAppointment(true)} className="gap-1">
              <Plus className="h-3.5 w-3.5" />
              Book Appointment
            </Button>
          </div>

          {/* Book Appointment Form */}
          {showAddAppointment && (
            <Card className="border border-primary/20 bg-muted/20">
              <CardHeader className="p-4">
                <CardTitle className="text-sm font-bold">New Booking</CardTitle>
                <CardDescription className="text-xs">Select patient, doctor, and timeslot to log booking.</CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <form onSubmit={handleAddAppointmentSubmit} className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="a-pat">Select Patient</Label>
                    <select id="a-pat" className="w-full text-xs h-8 border border-input rounded-md px-2 bg-background" required value={newAppt.patient_id} onChange={(e) => setNewAppt({...newAppt, patient_id: e.target.value})}>
                      <option value="">-- Choose Patient --</option>
                      {patients.map(p => (
                        <option key={p.id} value={p.id}>{p.contact?.name} ({p.contact?.phone})</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="a-doc">Select Doctor</Label>
                    <select id="a-doc" className="w-full text-xs h-8 border border-input rounded-md px-2 bg-background" required value={newAppt.doctor_id} onChange={(e) => {
                      const doc = doctors.find(d => d.id === e.target.value);
                      setNewAppt({...newAppt, doctor_id: e.target.value, department: doc ? doc.department : "General Medicine"});
                    }}>
                      <option value="">-- Choose Doctor --</option>
                      {doctors.map(d => (
                        <option key={d.id} value={d.id}>{d.name} ({d.department})</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="a-branch">Clinic Branch</Label>
                    <select id="a-branch" className="w-full text-xs h-8 border border-input rounded-md px-2 bg-background" value={newAppt.branch_id} onChange={(e) => setNewAppt({...newAppt, branch_id: e.target.value})}>
                      <option value="">-- Main Branch --</option>
                      {branches.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label htmlFor="a-date">Date</Label>
                      <Input id="a-date"  type="date" required value={newAppt.date} onChange={(e) => setNewAppt({...newAppt, date: e.target.value})} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="a-time">Time</Label>
                      <Input id="a-time"  type="time" required value={newAppt.time} onChange={(e) => setNewAppt({...newAppt, time: e.target.value})} />
                    </div>
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label htmlFor="a-notes">Booking Notes</Label>
                    <Input id="a-notes"  value={newAppt.notes} onChange={(e) => setNewAppt({...newAppt, notes: e.target.value})} placeholder="Reason for consultation, symptoms, etc." />
                  </div>
                  <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
                    <Button type="button" variant="ghost" size="xs" onClick={() => setShowAddAppointment(false)}>Cancel</Button>
                    <Button type="submit" size="xs">Confirm Appointment</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Bookings List */}
          {appointments.length === 0 ? (
            <div className="text-center py-8 text-xs text-muted-foreground border border-dashed rounded-lg">No scheduled appointments logged.</div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border bg-card">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                    <th className="p-3">Patient</th>
                    <th className="p-3">Doctor</th>
                    <th className="p-3">Date/Time</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {appointments.map((appt) => (
                    <tr key={appt.id} className="hover:bg-muted/10">
                      <td className="p-3">
                        <span className="font-semibold text-foreground block">{appt.patient?.name}</span>
                        <span className="text-[10px] text-muted-foreground">{appt.patient?.phone}</span>
                      </td>
                      <td className="p-3">
                        <span className="text-foreground block">{appt.doctor?.name || "Any Doctor"}</span>
                        <span className="text-[10px] text-muted-foreground">{appt.department}</span>
                      </td>
                      <td className="p-3">
                        <span className="text-foreground block">{appt.appointment_date}</span>
                        <span className="text-[10px] font-semibold text-muted-foreground">{appt.appointment_time.slice(0, 5)}</span>
                      </td>
                      <td className="p-3">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${
                          appt.status === "completed" 
                            ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" 
                            : appt.status === "cancelled" 
                            ? "bg-red-500/10 text-red-500 border border-red-500/20" 
                            : "bg-blue-500/10 text-blue-500 border border-blue-500/20"
                        }`}>
                          {appt.status}
                        </span>
                      </td>
                      <td className="p-3 text-right space-x-1.5 whitespace-nowrap">
                        {appt.status === "pending" && (
                          <>
                            <Button size="xs" variant="outline" className="h-6 text-[10px]" onClick={() => handleUpdateApptStatus(appt.id, appt.status, "completed")}>
                              Complete
                            </Button>
                            <Button size="xs" variant="ghost" className="h-6 text-[10px] text-destructive hover:bg-destructive/10" onClick={() => handleUpdateApptStatus(appt.id, appt.status, "cancelled")}>
                              Cancel
                            </Button>
                          </>
                        )}
                        {appt.status === "completed" && (
                          <span className="text-muted-foreground text-[10px]">No Actions</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: DOCTORS */}
      {activeTab === "doctors" && (
        <div className="space-y-4 animate-in fade-in-30">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Doctors Directory</h3>
            <Button size="xs" onClick={() => setShowAddDoctor(true)} className="gap-1">
              <Plus className="h-3.5 w-3.5" />
              Add Doctor
            </Button>
          </div>

          {/* Add Doctor Dialog */}
          {showAddDoctor && (
            <Card className="border border-primary/20 bg-muted/20">
              <CardHeader className="p-4">
                <CardTitle className="text-sm font-bold">Add Doctor Profile</CardTitle>
                <CardDescription className="text-xs">Add consultation shifts, departments, and fee details.</CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <form onSubmit={handleAddDoctorSubmit} className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="d-name">Doctor Name</Label>
                    <Input id="d-name"  required value={newDoctor.name} onChange={(e) => setNewDoctor({...newDoctor, name: e.target.value})} placeholder="e.g. Dr. Vance" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="d-dept">Department</Label>
                    <select id="d-dept" className="w-full text-xs h-8 border border-input rounded-md px-2 bg-background" value={newDoctor.department} onChange={(e) => setNewDoctor({...newDoctor, department: e.target.value})}>
                      <option>General Medicine</option>
                      <option>Cardiology</option>
                      <option>Pediatrics</option>
                      <option>Dermatology</option>
                      <option>Orthopedics</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="d-spec">Specialization</Label>
                    <Input id="d-spec"  value={newDoctor.specialization} onChange={(e) => setNewDoctor({...newDoctor, specialization: e.target.value})} placeholder="e.g. Pediatric Surgeon" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="d-fee">Consultation Fee ($)</Label>
                    <Input id="d-fee"  type="number" value={newDoctor.consultation_fee} onChange={(e) => setNewDoctor({...newDoctor, consultation_fee: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="d-branch">Branch Allocation</Label>
                    <select id="d-branch" className="w-full text-xs h-8 border border-input rounded-md px-2 bg-background" value={newDoctor.branch_id} onChange={(e) => setNewDoctor({...newDoctor, branch_id: e.target.value})}>
                      <option value="">-- Choose Branch --</option>
                      {branches.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label htmlFor="d-start">Shift Start</Label>
                      <Input id="d-start"  type="time" value={newDoctor.start_time} onChange={(e) => setNewDoctor({...newDoctor, start_time: e.target.value})} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="d-end">Shift End</Label>
                      <Input id="d-end"  type="time" value={newDoctor.end_time} onChange={(e) => setNewDoctor({...newDoctor, end_time: e.target.value})} />
                    </div>
                  </div>
                  <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
                    <Button type="button" variant="ghost" size="xs" onClick={() => setShowAddDoctor(false)}>Cancel</Button>
                    <Button type="submit" size="xs">Save Doctor</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Doctors Grid */}
          {doctors.length === 0 ? (
            <div className="text-center py-8 text-xs text-muted-foreground border border-dashed rounded-lg">No doctor records logged. Seed demo data to see.</div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {doctors.map((doc) => (
                <Card key={doc.id} className="border border-border bg-card p-4 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-sm font-semibold text-foreground">{doc.name}</h4>
                      <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">{doc.department}</span>
                    </div>
                    <span className="text-xs font-bold text-emerald-500">${doc.consultation_fee / 100}</span>
                  </div>

                  <div className="text-xs text-muted-foreground border-t border-border/50 pt-2 space-y-1">
                    <p className="flex justify-between">
                      <span>Days:</span>
                      <span className="text-foreground font-medium">{doc.available_days.join(", ")}</span>
                    </p>
                    <p className="flex justify-between">
                      <span>Hours:</span>
                      <span className="text-foreground font-medium">{doc.working_hours.start} - {doc.working_hours.end}</span>
                    </p>
                    {doc.specialization && (
                      <p className="flex justify-between">
                        <span>Specialty:</span>
                        <span className="text-foreground font-medium">{doc.specialization}</span>
                      </p>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: LAB REPORTS */}
      {activeTab === "lab-reports" && (
        <div className="space-y-4 animate-in fade-in-30">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Laboratory Tests</h3>
            <Button size="xs" onClick={() => setShowAddReport(true)} className="gap-1">
              <Plus className="h-3.5 w-3.5" />
              Book Lab Test
            </Button>
          </div>

          {/* Book Lab Report Form */}
          {showAddReport && (
            <Card className="border border-primary/20 bg-muted/20">
              <CardHeader className="p-4">
                <CardTitle className="text-sm font-bold">Log Medical Test</CardTitle>
                <CardDescription className="text-xs">Schedule a test order for a registered patient.</CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <form onSubmit={handleAddReportSubmit} className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="lr-pat">Select Patient</Label>
                    <select id="lr-pat" className="w-full text-xs h-8 border border-input rounded-md px-2 bg-background" required value={newReport.patient_id} onChange={(e) => setNewReport({...newReport, patient_id: e.target.value})}>
                      <option value="">-- Choose Patient --</option>
                      {patients.map(p => (
                        <option key={p.id} value={p.id}>{p.contact?.name} ({p.contact?.phone})</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="lr-name">Test / Panel Name</Label>
                    <Input id="lr-name"  required value={newReport.test_name} onChange={(e) => setNewReport({...newReport, test_name: e.target.value})} placeholder="e.g. Lipid Profile, Complete Blood Count" />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label htmlFor="lr-res">Diagnostic Notes / Findings Summary</Label>
                    <Input id="lr-res"  value={newReport.result_summary} onChange={(e) => setNewReport({...newReport, result_summary: e.target.value})} placeholder="Enter parameters, metrics, or normal range remarks" />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label htmlFor="lr-file">Lab Report PDF URL (Mock Attachment)</Label>
                    <Input id="lr-file"  value={newReport.file_url} onChange={(e) => setNewReport({...newReport, file_url: e.target.value})} placeholder="e.g. https://storage.wacrm.com/reports/cbc.pdf" />
                  </div>
                  <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
                    <Button type="button" variant="ghost" size="xs" onClick={() => setShowAddReport(false)}>Cancel</Button>
                    <Button type="submit" size="xs">Log Test Order</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Test Orders List */}
          {labReports.length === 0 ? (
            <div className="text-center py-8 text-xs text-muted-foreground border border-dashed rounded-lg">No diagnostic lab orders logged.</div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border bg-card">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                    <th className="p-3">Patient</th>
                    <th className="p-3">Diagnostic Panel</th>
                    <th className="p-3">Date Ordered</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {labReports.map((report) => (
                    <tr key={report.id} className="hover:bg-muted/10">
                      <td className="p-3">
                        <span className="font-semibold text-foreground block">{report.patient?.name}</span>
                        <span className="text-[10px] text-muted-foreground">{report.patient?.phone}</span>
                      </td>
                      <td className="p-3">
                        <span className="text-foreground font-medium block">{report.test_name}</span>
                        {report.result_summary && <span className="text-[10px] text-muted-foreground">{report.result_summary}</span>}
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {new Date(report.created_at).toLocaleDateString()}
                      </td>
                      <td className="p-3">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold capitalize border ${
                          report.status === "ready" 
                            ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" 
                            : "bg-blue-500/10 text-blue-500 border-blue-500/20"
                        }`}>
                          {report.status}
                        </span>
                      </td>
                      <td className="p-3 text-right whitespace-nowrap">
                        {report.status !== "ready" ? (
                          <Button size="xs" className="h-6 text-[10px]" onClick={() => handleMarkReportReady(report.id)}>
                            Mark Ready & Notify
                          </Button>
                        ) : (
                          <span className="text-emerald-500 text-[10px] font-semibold">Patient Notified</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: BILLING */}
      {activeTab === "billing" && (
        <div className="space-y-4 animate-in fade-in-30">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Billing Registry</h3>
            <Button size="xs" onClick={() => setShowAddInvoice(true)} className="gap-1">
              <Plus className="h-3.5 w-3.5" />
              Generate Invoice
            </Button>
          </div>

          {/* Add Invoice Form */}
          {showAddInvoice && (
            <Card className="border border-primary/20 bg-muted/20">
              <CardHeader className="p-4">
                <CardTitle className="text-sm font-bold">New Invoice Generation</CardTitle>
                <CardDescription className="text-xs">Generate invoice. Reminders are pushed to WhatsApp.</CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <form onSubmit={handleAddInvoiceSubmit} className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="i-pat">Select Patient</Label>
                    <select id="i-pat" className="w-full text-xs h-8 border border-input rounded-md px-2 bg-background" required value={newInvoice.patient_id} onChange={(e) => setNewInvoice({...newInvoice, patient_id: e.target.value})}>
                      <option value="">-- Choose Patient --</option>
                      {patients.map(p => (
                        <option key={p.id} value={p.id}>{p.contact?.name} ({p.contact?.phone})</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="i-amt">Invoice Amount ($)</Label>
                    <Input id="i-amt"  type="number" required value={newInvoice.amount} onChange={(e) => setNewInvoice({...newInvoice, amount: e.target.value})} placeholder="e.g. 150" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="i-due">Due Date</Label>
                    <Input id="i-due"  type="date" value={newInvoice.due_date} onChange={(e) => setNewInvoice({...newInvoice, due_date: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="i-appt">Linked Appointment (Optional)</Label>
                    <select id="i-appt" className="w-full text-xs h-8 border border-input rounded-md px-2 bg-background" value={newInvoice.appointment_id} onChange={(e) => setNewInvoice({...newInvoice, appointment_id: e.target.value})}>
                      <option value="">-- None --</option>
                      {appointments.map(a => (
                        <option key={a.id} value={a.id}>{a.patient?.name} - {a.appointment_date}</option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
                    <Button type="button" variant="ghost" size="xs" onClick={() => setShowAddInvoice(false)}>Cancel</Button>
                    <Button type="submit" size="xs">Create Bill</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Invoices List */}
          {invoices.length === 0 ? (
            <div className="text-center py-8 text-xs text-muted-foreground border border-dashed rounded-lg">No billing invoices found.</div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border bg-card">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                    <th className="p-3">Invoice ID</th>
                    <th className="p-3">Patient</th>
                    <th className="p-3">Due Date</th>
                    <th className="p-3">Amount</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-muted/10">
                      <td className="p-3 font-semibold text-foreground">
                        {inv.invoice_number}
                      </td>
                      <td className="p-3">
                        <span className="font-semibold text-foreground block">{inv.patient?.name}</span>
                        <span className="text-[10px] text-muted-foreground">{inv.patient?.phone}</span>
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {inv.due_date || "N/A"}
                      </td>
                      <td className="p-3 text-foreground font-medium">
                        ${inv.amount / 100}
                      </td>
                      <td className="p-3">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold capitalize border ${
                          inv.status === "paid" 
                            ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" 
                            : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                        }`}>
                          {inv.status}
                        </span>
                      </td>
                      <td className="p-3 text-right space-x-1.5 whitespace-nowrap">
                        {inv.status === "unpaid" && (
                          <Button size="xs" variant="outline" className="h-6 text-[10px] gap-1" onClick={() => handleSendBillReminder(inv.id)}>
                            <PhoneCall className="h-2.5 w-2.5" />
                            Send WA Reminder
                          </Button>
                        )}
                        {inv.status === "paid" && (
                          <span className="text-emerald-500 text-[10px] font-semibold">Receipt Settled</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: BRANCHES */}
      {activeTab === "branches" && (
        <div className="space-y-4 animate-in fade-in-30">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Clinic Branch Sites</h3>
            <Button size="xs" onClick={() => setShowAddBranch(true)} className="gap-1">
              <Plus className="h-3.5 w-3.5" />
              Add Branch
            </Button>
          </div>

          {/* Add Branch Dialog */}
          {showAddBranch && (
            <Card className="border border-primary/20 bg-muted/20">
              <CardHeader className="p-4">
                <CardTitle className="text-sm font-bold">New Branch Registry</CardTitle>
                <CardDescription className="text-xs">Register physical hospital site.</CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <form onSubmit={handleAddBranchSubmit} className="grid gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="b-name">Branch Location Name</Label>
                    <Input id="b-name"  required value={newBranch.name} onChange={(e) => setNewBranch({...newBranch, name: e.target.value})} placeholder="e.g. West Coast Clinic" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="b-addr">Street Address</Label>
                    <Input id="b-addr"  value={newBranch.address} onChange={(e) => setNewBranch({...newBranch, address: e.target.value})} placeholder="Street address" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="b-phone">Contact Number</Label>
                    <Input id="b-phone"  value={newBranch.phone} onChange={(e) => setNewBranch({...newBranch, phone: e.target.value})} placeholder="+1555XXXX" />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="ghost" size="xs" onClick={() => setShowAddBranch(false)}>Cancel</Button>
                    <Button type="submit" size="xs">Save Branch</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Branches Grid */}
          {branches.length === 0 ? (
            <div className="text-center py-8 text-xs text-muted-foreground border border-dashed rounded-lg">No clinic branches registered. Please seed demo data or add a branch.</div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
              {branches.map((b) => (
                <Card key={b.id} className="border border-border bg-card p-4 space-y-2">
                  <div>
                    <h4 className="text-sm font-semibold text-foreground flex items-center gap-1">
                      <MapPin className="h-4 w-4 text-primary shrink-0" />
                      {b.name}
                    </h4>
                    <p className="text-xs text-muted-foreground mt-1 leading-normal">{b.address || "No address added"}</p>
                  </div>
                  {b.phone && (
                    <div className="text-xs text-muted-foreground border-t border-border/40 pt-2">
                      <span className="block text-[10px] uppercase font-bold tracking-wider">Phone</span>
                      <span className="text-foreground">{b.phone}</span>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
