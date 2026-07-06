"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  FileText,
  Plus,
  Loader2,
  Check,
  Search,
  Activity,
  FileDown,
  FileUp,
  Bell,
  Package,
} from "lucide-react";
import { toast } from "sonner";

interface LabReport {
  id: string;
  test_name: string;
  status: "pending" | "processing" | "ready" | "delivered";
  result_url?: string;
  report_pdf_url?: string;
  notes?: string;
  department?: string;
  doctor_id?: string;
  internal_notes?: string;
  expected_delivery_date?: string;
  notified_patient?: boolean;
  created_at: string;
  updated_at?: string;
  patient: { id: string; name: string; phone: string } | null;
  doctor: { id: string; name: string } | null;
}

interface Patient {
  id: string;
  name: string;
}

interface Doctor {
  id: string;
  name: string;
  department: string;
}

export default function LabReportsPage() {
  const { accountId } = useAuth();
  const [reports, setReports] = useState<LabReport[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<"all" | "pending" | "processing" | "ready" | "delivered">("all");

  // Form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [patientId, setPatientId] = useState("");
  const [testName, setTestName] = useState("");
  const [status, setStatus] = useState<"pending" | "processing" | "ready">("pending");
  const [department, setDepartment] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [pdfUrl, setPdfUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [resultUrl, setResultUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [notifying, setNotifying] = useState("");
  const [uploadingPdf, setUploadingPdf] = useState(false);

  const loadData = useCallback(async () => {
    if (!accountId) return;
    const db = createClient();
    try {
      const { data: reportRows } = await db
        .from("hospital_lab_reports")
        .select(`
          id,
          test_name,
          status,
          result_url,
          report_pdf_url,
          notes,
          department,
          doctor_id,
          internal_notes,
          expected_delivery_date,
          notified_patient,
          created_at,
          updated_at,
          patient:contacts(id, name, phone),
          doctor:hospital_doctors(id, name)
        `)
        .eq("account_id", accountId)
        .order("created_at", { ascending: false });

      setReports((reportRows as any) || []);

      // Fetch patients
      const { data: pats } = await db
        .from("patients")
        .select("id, contact:contacts(name)")
        .eq("account_id", accountId);

      const mappedPats = (pats || []).map((p: any) => ({
        id: p.id,
        name: p.contact?.name || "Unknown Patient",
      }));
      setPatients(mappedPats);

      // Fetch doctors
      const { data: docsData } = await db
        .from("hospital_doctors")
        .select("id, name, department")
        .eq("account_id", accountId)
        .eq("status", "active");

      setDoctors((docsData as any) || []);
    } catch (err) {
      console.error("Error loading lab reports:", err);
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      toast.error("Only PDF files are supported for lab reports.");
      return;
    }

    if (file.size > 16 * 1024 * 1024) {
      toast.error("File exceeds maximum allowed size (16 MB).");
      return;
    }

    setUploadingPdf(true);
    try {
      const { uploadAccountMedia } = await import("@/lib/storage/upload-media");
      const result = await uploadAccountMedia("chat-media", file);
      setPdfUrl(result.publicUrl);
      toast.success("PDF uploaded successfully!");
    } catch (err: any) {
      toast.error("Upload failed: " + err.message);
    } finally {
      setUploadingPdf(false);
    }
  };

  const handleRowFileUpload = async (reportId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      toast.error("Only PDF files are supported.");
      return;
    }

    if (file.size > 16 * 1024 * 1024) {
      toast.error("File exceeds maximum allowed size (16 MB).");
      return;
    }

    const toastId = toast.loading("Uploading PDF...");
    try {
      const { uploadAccountMedia } = await import("@/lib/storage/upload-media");
      const result = await uploadAccountMedia("chat-media", file);
      
      const db = createClient();
      const { error } = await db
        .from("hospital_lab_reports")
        .update({ report_pdf_url: result.publicUrl, updated_at: new Date().toISOString() })
        .eq("id", reportId);

      if (error) throw error;

      toast.success("PDF uploaded and linked to report!", { id: toastId });
      loadData();
    } catch (err: any) {
      toast.error("Upload failed: " + err.message, { id: toastId });
    }
  };

  const handleCreateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId || !testName) {
      toast.error("Please fill in patient and test name.");
      return;
    }

    setSaving(true);
    const db = createClient();

    try {
      const { error } = await db.from("hospital_lab_reports").insert({
        account_id: accountId,
        patient_id: patientId,
        test_name: testName,
        status: status,
        department: department || null,
        doctor_id: doctorId || null,
        expected_delivery_date: expectedDate || null,
        report_pdf_url: pdfUrl || null,
        result_url: resultUrl || null,
        notes: notes || null,
        internal_notes: internalNotes || null,
      });

      if (error) throw error;

      toast.success("Lab report created successfully!");
      setPatientId("");
      setTestName("");
      setNotes("");
      setResultUrl("");
      setDepartment("");
      setDoctorId("");
      setExpectedDate("");
      setPdfUrl("");
      setInternalNotes("");
      setShowAddForm(false);
      loadData();
    } catch (err: any) {
      toast.error("Failed to record lab test: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateStatus = async (reportId: string, newStatus: "pending" | "processing" | "ready" | "delivered") => {
    const db = createClient();
    try {
      const { error } = await db
        .from("hospital_lab_reports")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", reportId);

      if (error) throw error;
      toast.success(`Lab status updated to ${newStatus}.`);

      if (newStatus === "ready") {
        setNotifying(reportId);
        try {
          const res = await fetch("/api/lab-reports/notify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reportId, accountId }),
          });
          if (res.ok) {
            toast.success("Patient notified on WhatsApp!");
          } else {
            toast.error("Failed to notify patient on WhatsApp.");
          }
        } catch (e) {
          toast.error("Notification request failed.");
        } finally {
          setNotifying("");
        }
      }

      loadData();
    } catch (err: any) {
      toast.error("Status update failed: " + err.message);
    }
  };

  const handleTriggerManualNotification = async (reportId: string) => {
    setNotifying(reportId);
    try {
      const res = await fetch("/api/lab-reports/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId, accountId }),
      });
      if (res.ok) {
        toast.success("Notification sent successfully!");
        loadData();
      } else {
        toast.error("Failed to notify patient on WhatsApp.");
      }
    } catch (e) {
      toast.error("Notification request failed.");
    } finally {
      setNotifying("");
    }
  };

  const filteredReports = reports.filter((rep) => {
    if (activeFilter === "all") return true;
    return rep.status === activeFilter;
  });

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
          <h1 className="text-2xl font-bold text-foreground">Diagnostic Lab Manager</h1>
          <p className="text-sm text-muted-foreground font-medium">Book lab diagnostics, track sample statuses, and deliver reports.</p>
        </div>
        <Button onClick={() => setShowAddForm(!showAddForm)} className="cursor-pointer">
          <Plus className="h-4 w-4 mr-2" /> Book Diagnostic Test
        </Button>
      </div>

      {showAddForm && (
        <form onSubmit={handleCreateReport} className="bg-card border border-border rounded-xl p-5 space-y-4 max-w-2xl animate-in fade-in slide-in-from-top-4 duration-200">
          <h3 className="font-bold text-foreground">Book Lab Test</h3>
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
              <Label>Test Name / Panel *</Label>
              <Input value={testName} onChange={(e) => setTestName(e.target.value)} placeholder="e.g. Lipid Profile, Blood Glucose (Fasting)" required />
            </div>
            <div className="space-y-2">
              <Label>Department</Label>
              <select value={department} onChange={(e) => setDepartment(e.target.value)} className="w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <option value="">-- Select Department --</option>
                <option value="Pathology">Pathology</option>
                <option value="Radiology">Radiology</option>
                <option value="Microbiology">Microbiology</option>
                <option value="Biochemistry">Biochemistry</option>
                <option value="Hematology">Hematology</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Referred By Doctor</Label>
              <select value={doctorId} onChange={(e) => setDoctorId(e.target.value)} className="w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <option value="">-- Select Doctor --</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>Dr. {d.name} ({d.department})</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Expected Delivery Date</Label>
              <Input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Initial Status</Label>
              <select value={status} onChange={(e) => setStatus(e.target.value as any)} className="w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <option value="pending">Pending (Sample Collection Pending)</option>
                <option value="processing">Processing (Sample Collected / In Progress)</option>
                <option value="ready">Ready (Report Completed & Ready to Deliver)</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Report PDF (Upload File or Enter Link)</Label>
              <div className="flex gap-2">
                <Input value={pdfUrl} onChange={(e) => setPdfUrl(e.target.value)} placeholder="Link to PDF document or upload →" />
                <div className="relative">
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={handleFileUpload}
                    disabled={uploadingPdf}
                    className="hidden"
                    id="lab-report-file-upload"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={uploadingPdf}
                    onClick={() => document.getElementById("lab-report-file-upload")?.click()}
                    className="cursor-pointer whitespace-nowrap"
                  >
                    {uploadingPdf ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <FileUp className="h-4 w-4 mr-1" />
                    )}
                    Upload PDF
                  </Button>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Lab Portal Link / External URL (Optional)</Label>
              <Input value={resultUrl} onChange={(e) => setResultUrl(e.target.value)} placeholder="Link to patient portal result page..." />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Notes (Visible to Patient via WhatsApp)</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Preliminary remarks for the patient..." />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Internal Staff Notes (Private / Staff Only)</Label>
              <Input value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} placeholder="Confidential lab notes for clinic personnel..." />
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => setShowAddForm(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Log Test
            </Button>
          </div>
        </form>
      )}

      {/* Tabs */}
      <div className="flex border-b border-border">
        {(["all", "pending", "processing", "ready", "delivered"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveFilter(tab)}
            className={`px-4 py-2 border-b-2 text-sm font-semibold capitalize transition-colors ${
              activeFilter === tab
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Lab listing */}
      {filteredReports.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl p-12 text-center max-w-2xl mx-auto">
          <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-bold text-foreground">No reports recorded</h3>
          <p className="text-muted-foreground text-sm mt-1">There are no diagnostic records matching this filter.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-muted-foreground">
              <thead className="text-xs uppercase bg-muted/50 border-b border-border text-foreground font-semibold">
                <tr>
                  <th className="px-6 py-4">Patient</th>
                  <th className="px-6 py-4">Test Description</th>
                  <th className="px-6 py-4">Department & Doctor</th>
                  <th className="px-6 py-4">Expected Date</th>
                  <th className="px-6 py-4">PDF Report</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-foreground">
                {filteredReports.map((rep) => {
                  const docData = rep.doctor as any;
                  const docName = (Array.isArray(docData) ? docData[0]?.name : docData?.name) || "—";
                  return (
                    <tr key={rep.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4 font-semibold">
                        <div>
                          <div>{rep.patient?.name || "Unknown Patient"}</div>
                          <div className="text-xs text-muted-foreground font-normal">{rep.patient?.phone}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-primary">{rep.test_name}</div>
                        {rep.notes && <div className="text-xs text-muted-foreground font-normal mt-0.5">{rep.notes}</div>}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold">{rep.department || "General"}</div>
                        <div className="text-xs text-muted-foreground font-normal">Ref: Dr. {docName}</div>
                      </td>
                      <td className="px-6 py-4">
                        {rep.expected_delivery_date ? new Date(rep.expected_delivery_date).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-6 py-4">
                        {rep.report_pdf_url ? (
                          <a
                            href={rep.report_pdf_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                          >
                            <FileDown className="h-3.5 w-3.5" /> Download
                          </a>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-muted-foreground">None</span>
                            <div className="relative">
                              <input
                                type="file"
                                accept=".pdf,application/pdf"
                                onChange={(e) => handleRowFileUpload(rep.id, e)}
                                className="hidden"
                                id={`row-upload-${rep.id}`}
                              />
                              <Button
                                size="xs"
                                variant="ghost"
                                onClick={() => document.getElementById(`row-upload-${rep.id}`)?.click()}
                                className="h-6 px-1.5 text-[10px] text-primary hover:bg-primary/10 cursor-pointer"
                              >
                                Upload
                              </Button>
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                          rep.status === "ready"
                            ? "bg-emerald-500/10 text-emerald-500"
                            : rep.status === "processing"
                            ? "bg-sky-500/10 text-sky-500 animate-pulse"
                            : rep.status === "delivered"
                            ? "bg-indigo-500/10 text-indigo-500"
                            : "bg-amber-500/10 text-amber-500"
                        }`}>
                          {rep.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right space-x-1.5 flex justify-end items-center">
                        {rep.status === "pending" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleUpdateStatus(rep.id, "processing")}
                            className="bg-sky-500/10 border-sky-500/20 text-sky-500 hover:bg-sky-500/20 text-xs py-1 px-2.5 cursor-pointer"
                          >
                            Start Processing
                          </Button>
                        )}
                        {rep.status === "processing" && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={notifying === rep.id}
                            onClick={() => handleUpdateStatus(rep.id, "ready")}
                            className="bg-emerald-500/10 border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/20 text-xs py-1 px-2.5 cursor-pointer"
                          >
                            {notifying === rep.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                            ) : (
                              <Check className="h-3.5 w-3.5 mr-1" />
                            )}
                            Mark Ready
                          </Button>
                        )}
                        {rep.status === "ready" && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={notifying === rep.id}
                              onClick={() => handleTriggerManualNotification(rep.id)}
                              className="bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 text-xs py-1 px-2.5 cursor-pointer"
                            >
                              {notifying === rep.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                              ) : (
                                <Bell className="h-3.5 w-3.5 mr-1" />
                              )}
                              {rep.notified_patient ? "Resend WA" : "Notify WA"}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleUpdateStatus(rep.id, "delivered")}
                              className="bg-indigo-500/10 border-indigo-500/20 text-indigo-500 hover:bg-indigo-500/20 text-xs py-1 px-2.5 cursor-pointer"
                            >
                              Deliver
                            </Button>
                          </>
                        )}
                        {rep.status === "delivered" && (
                          <span className="inline-flex items-center text-xs text-muted-foreground font-semibold">
                            <Check className="h-3.5 w-3.5 mr-1 text-emerald-500" /> Delivered
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
