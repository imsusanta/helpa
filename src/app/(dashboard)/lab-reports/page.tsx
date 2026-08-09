'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Plus,
  Loader2,
  Check,
  Activity,
  FileDown,
  FileUp,
  Bell,
  MessageSquare,
  Edit,
} from 'lucide-react';
import { toast } from 'sonner';

interface LabReport {
  id: string;
  test_name: string;
  status: 'pending' | 'processing' | 'ready' | 'delivered';
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
  const [activeFilter, setActiveFilter] = useState<
    'all' | 'pending' | 'processing' | 'ready' | 'delivered'
  >('all');

  // Form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [patientId, setPatientId] = useState('');
  const [testName, setTestName] = useState('');
  const [status, setStatus] = useState<
    'pending' | 'processing' | 'ready' | 'delivered'
  >('pending');
  const [department, setDepartment] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [pdfUrl, setPdfUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [resultUrl, setResultUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [notifying, setNotifying] = useState('');
  const [uploadingPdf, setUploadingPdf] = useState(false);

  // Edit form states
  const [editingReportId, setEditingReportId] = useState<string | null>(null);
  const [editTestName, setEditTestName] = useState('');
  const [editStatus, setEditStatus] = useState<
    'pending' | 'processing' | 'ready' | 'delivered'
  >('pending');
  const [editDepartment, setEditDepartment] = useState('');
  const [editDoctorId, setEditDoctorId] = useState('');
  const [editExpectedDate, setEditExpectedDate] = useState('');
  const [editPdfUrl, setEditPdfUrl] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editInternalNotes, setEditInternalNotes] = useState('');
  const [editResultUrl, setEditResultUrl] = useState('');
  const [updating, setUpdating] = useState(false);
  const [uploadingEditPdf, setUploadingEditPdf] = useState(false);

  const loadData = useCallback(async () => {
    if (!accountId) return;
    const db = createClient();
    try {
      const { data: repData, error } = await db
        .from('hospital_lab_reports')
        .select(
          '*, patient:patients(id, contact:contacts(name, phone)), doctor:hospital_doctors(id, name)'
        )
        .eq('account_id', accountId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedReports: LabReport[] = (repData || []).map((r) => {
        const item = r as Record<string, unknown>;
        const pData = item.patient as {
          id: string;
          contact: { name: string; phone: string } | null;
        } | null;
        const docObj = item.doctor as { id: string; name: string } | null;
        return {
          id: item.id as string,
          account_id: item.account_id as string,
          patient_id: item.patient_id as string,
          doctor_id: item.doctor_id as string,
          test_name: item.test_name as string,
          department: item.department as string,
          status: item.status as LabReport['status'],
          report_pdf_url: item.report_pdf_url as string,
          expected_delivery_date: item.expected_delivery_date as string,
          notes: item.notes as string,
          created_at: item.created_at as string,
          updated_at: item.updated_at as string,
          patient: pData
            ? {
                id: pData.id,
                name: pData.contact?.name || 'Unknown Patient',
                phone: pData.contact?.phone || '—',
              }
            : null,
          doctor: docObj
            ? {
                id: docObj.id,
                name: docObj.name,
              }
            : null,
        };
      });

      setReports(formattedReports);

      // Fetch patients
      const { data: pats } = await db
        .from('patients')
        .select('id, contact:contacts(name)')
        .eq('account_id', accountId);

      const mappedPats = (pats || []).map((p) => {
        const item = p as Record<string, unknown>;
        const cData = item.contact as
          | { name?: string }
          | { name?: string }[]
          | null;
        const cName =
          (Array.isArray(cData) ? cData[0]?.name : cData?.name) ||
          'Unknown Patient';
        return {
          id: item.id as string,
          name: cName,
        };
      });
      setPatients(mappedPats);

      // Fetch doctors
      const { data: docsData } = await db
        .from('hospital_doctors')
        .select('id, name, department')
        .eq('account_id', accountId)
        .eq('status', 'active');

      setDoctors((docsData as unknown as Doctor[]) || []);
    } catch (err) {
      console.error('Error loading lab reports:', err);
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

    if (file.type !== 'application/pdf') {
      toast.error('Only PDF files are supported for lab reports.');
      return;
    }

    if (file.size > 16 * 1024 * 1024) {
      toast.error('File exceeds maximum allowed size (16 MB).');
      return;
    }

    setUploadingPdf(true);
    try {
      const { uploadAccountMedia } = await import('@/lib/storage/upload-media');
      const result = await uploadAccountMedia('chat-media', file);
      setPdfUrl(result.publicUrl);
      toast.success('PDF uploaded successfully!');
    } catch (err: unknown) {
      toast.error('Upload failed: ' + (err as Error).message);
    } finally {
      setUploadingPdf(false);
    }
  };

  const handleEditFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      toast.error('Only PDF files are supported for lab reports.');
      return;
    }

    if (file.size > 16 * 1024 * 1024) {
      toast.error('File exceeds maximum allowed size (16 MB).');
      return;
    }

    setUploadingEditPdf(true);
    try {
      const { uploadAccountMedia } = await import('@/lib/storage/upload-media');
      const result = await uploadAccountMedia('chat-media', file);
      setEditPdfUrl(result.publicUrl);
      toast.success('PDF uploaded successfully!');
    } catch (err: unknown) {
      toast.error('Upload failed: ' + (err as Error).message);
    } finally {
      setUploadingEditPdf(false);
    }
  };

  const startEditReport = (rep: LabReport) => {
    setEditingReportId(rep.id);
    setEditTestName(rep.test_name);
    setEditStatus(rep.status);
    setEditDepartment(rep.department || '');
    setEditDoctorId(rep.doctor_id || '');
    setEditExpectedDate(rep.expected_delivery_date || '');
    setEditPdfUrl(rep.report_pdf_url || '');
    setEditNotes(rep.notes || '');
    setEditInternalNotes(rep.internal_notes || '');
    setEditResultUrl(rep.result_url || '');
    setShowAddForm(false); // Close add form if open
  };

  const handleUpdateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReportId || !accountId) return;
    setUpdating(true);
    const db = createClient();
    try {
      const { error } = await db
        .from('hospital_lab_reports')
        .update({
          test_name: editTestName,
          status: editStatus,
          department: editDepartment || null,
          doctor_id: editDoctorId || null,
          expected_delivery_date: editExpectedDate || null,
          report_pdf_url: editPdfUrl || null,
          notes: editNotes || null,
          internal_notes: editInternalNotes || null,
          result_url: editResultUrl || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingReportId);

      if (error) throw error;
      toast.success('Diagnostic report updated successfully!');
      setEditingReportId(null);
      loadData();
    } catch (err: unknown) {
      toast.error('Failed to update report: ' + (err as Error).message);
    } finally {
      setUpdating(false);
    }
  };

  const handleRowFileUpload = async (
    reportId: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      toast.error('Only PDF files are supported.');
      return;
    }

    if (file.size > 16 * 1024 * 1024) {
      toast.error('File exceeds maximum allowed size (16 MB).');
      return;
    }

    const toastId = toast.loading('Uploading PDF...');
    try {
      const { uploadAccountMedia } = await import('@/lib/storage/upload-media');
      const result = await uploadAccountMedia('chat-media', file);

      const db = createClient();
      const { error } = await db
        .from('hospital_lab_reports')
        .update({
          report_pdf_url: result.publicUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', reportId);

      if (error) throw error;

      toast.success('PDF uploaded and linked to report!', { id: toastId });
      loadData();
    } catch (err: unknown) {
      toast.error('Upload failed: ' + (err as Error).message, { id: toastId });
    }
  };

  const handleCreateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId || !testName) {
      toast.error('Please fill in patient and test name.');
      return;
    }

    setSaving(true);
    const db = createClient();

    try {
      const { error } = await db.from('hospital_lab_reports').insert({
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

      toast.success('Lab report created successfully!');
      setPatientId('');
      setTestName('');
      setNotes('');
      setResultUrl('');
      setDepartment('');
      setDoctorId('');
      setExpectedDate('');
      setPdfUrl('');
      setInternalNotes('');
      setShowAddForm(false);
      loadData();
    } catch (err: unknown) {
      toast.error('Failed to record lab test: ' + (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateStatus = async (
    reportId: string,
    newStatus: 'pending' | 'processing' | 'ready' | 'delivered'
  ) => {
    const db = createClient();
    try {
      const { error } = await db
        .from('hospital_lab_reports')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', reportId);

      if (error) throw error;
      toast.success(`Lab status updated to ${newStatus}.`);

      if (newStatus === 'ready') {
        setNotifying(reportId);
        try {
          const res = await fetch('/api/lab-reports/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reportId, accountId }),
          });
          if (res.ok) {
            toast.success('Patient notified on WhatsApp!');
          } else {
            toast.error('Failed to notify patient on WhatsApp.');
          }
        } catch {
          toast.error('Notification request failed.');
        } finally {
          setNotifying('');
        }
      }

      loadData();
    } catch (err: unknown) {
      toast.error('Status update failed: ' + (err as Error).message);
    }
  };

  const handleTriggerManualNotification = async (reportId: string) => {
    setNotifying(reportId);
    try {
      const res = await fetch('/api/lab-reports/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId, accountId }),
      });
      if (res.ok) {
        toast.success('Notification sent successfully!');
        loadData();
      } else {
        toast.error('Failed to notify patient on WhatsApp.');
      }
    } catch {
      toast.error('Notification request failed.');
    } finally {
      setNotifying('');
    }
  };

  const filteredReports = reports.filter((rep) => {
    if (activeFilter === 'all') return true;
    return rep.status === activeFilter;
  });

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
          <h1 className="text-foreground text-2xl font-bold">Reports</h1>
          <p className="text-muted-foreground text-sm font-medium">
            Track patient reports and send via WhatsApp
          </p>
        </div>
        <Button
          onClick={() => setShowAddForm(!showAddForm)}
          className="cursor-pointer"
        >
          <Plus className="mr-2 h-4 w-4" /> New Report
        </Button>
      </div>

      {showAddForm && (
        <form
          onSubmit={handleCreateReport}
          className="bg-card border-border animate-in fade-in slide-in-from-top-4 max-w-2xl space-y-4 rounded-xl border p-5 duration-200"
        >
          <h3 className="text-foreground font-bold">New Diagnostic Report</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Select Patient *</Label>
              <select
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                required
                className="border-input bg-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
              >
                <option value="">-- Select Patient --</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Test Name / Panel *</Label>
              <Input
                value={testName}
                onChange={(e) => setTestName(e.target.value)}
                placeholder="e.g. Lipid Profile, Blood Glucose (Fasting)"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Department</Label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="border-input bg-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
              >
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
              <select
                value={doctorId}
                onChange={(e) => setDoctorId(e.target.value)}
                className="border-input bg-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
              >
                <option value="">-- Select Doctor --</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    Dr. {d.name} ({d.department})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Expected Delivery Date</Label>
              <Input
                type="date"
                value={expectedDate}
                onChange={(e) => setExpectedDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Initial Status</Label>
              <select
                value={status}
                onChange={(e) =>
                  setStatus(
                    e.target.value as
                      | 'pending'
                      | 'processing'
                      | 'ready'
                      | 'delivered'
                  )
                }
                className="border-input bg-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
              >
                <option value="pending">
                  Pending (Sample Collection Pending)
                </option>
                <option value="processing">
                  Processing (Sample Collected / In Progress)
                </option>
                <option value="ready">
                  Ready (Report Completed & Ready to Deliver)
                </option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Report PDF (Upload File or Enter Link)</Label>
              <div className="flex gap-2">
                <Input
                  value={pdfUrl}
                  onChange={(e) => setPdfUrl(e.target.value)}
                  placeholder="Link to PDF document or upload →"
                />
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
                    onClick={() =>
                      document.getElementById('lab-report-file-upload')?.click()
                    }
                    className="cursor-pointer whitespace-nowrap"
                  >
                    {uploadingPdf ? (
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    ) : (
                      <FileUp className="mr-1 h-4 w-4" />
                    )}
                    Upload PDF
                  </Button>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Lab Portal Link / External URL (Optional)</Label>
              <Input
                value={resultUrl}
                onChange={(e) => setResultUrl(e.target.value)}
                placeholder="Link to patient portal result page..."
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Notes (Visible to Patient via WhatsApp)</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Preliminary remarks for the patient..."
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Internal Staff Notes (Private / Staff Only)</Label>
              <Input
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                placeholder="Confidential lab notes for clinic personnel..."
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowAddForm(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save
              Report
            </Button>
          </div>
        </form>
      )}

      {editingReportId && (
        <form
          onSubmit={handleUpdateReport}
          className="bg-card border-border animate-in fade-in slide-in-from-top-4 max-w-2xl space-y-4 rounded-xl border p-5 duration-200"
        >
          <h3 className="text-foreground font-bold">Edit Diagnostic Report</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <span className="text-muted-foreground text-xs font-semibold">
                Patient:{' '}
                {reports.find((r) => r.id === editingReportId)?.patient?.name ||
                  'Unknown'}
              </span>
            </div>
            <div className="space-y-2">
              <Label>Test Name / Panel *</Label>
              <Input
                value={editTestName}
                onChange={(e) => setEditTestName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Department</Label>
              <select
                value={editDepartment}
                onChange={(e) => setEditDepartment(e.target.value)}
                className="border-input bg-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
              >
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
              <select
                value={editDoctorId}
                onChange={(e) => setEditDoctorId(e.target.value)}
                className="border-input bg-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
              >
                <option value="">-- Select Doctor --</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    Dr. {d.name} ({d.department})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Expected Delivery Date</Label>
              <Input
                type="date"
                value={editExpectedDate}
                onChange={(e) => setEditExpectedDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <select
                value={editStatus}
                onChange={(e) =>
                  setEditStatus(
                    e.target.value as
                      | 'pending'
                      | 'processing'
                      | 'ready'
                      | 'delivered'
                  )
                }
                className="border-input bg-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
              >
                <option value="pending">
                  Pending (Sample Collection Pending)
                </option>
                <option value="processing">
                  Processing (Sample Collected / In Progress)
                </option>
                <option value="ready">
                  Ready (Report Completed & Ready to Deliver)
                </option>
                <option value="delivered">
                  Delivered (Completed and Received by Patient)
                </option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Report PDF (Upload File or Enter Link)</Label>
              <div className="flex gap-2">
                <Input
                  value={editPdfUrl}
                  onChange={(e) => setEditPdfUrl(e.target.value)}
                  placeholder="Link to PDF document..."
                />
                <div className="relative">
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={handleEditFileUpload}
                    disabled={uploadingEditPdf}
                    className="hidden"
                    id="lab-report-file-upload-edit"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={uploadingEditPdf}
                    onClick={() =>
                      document
                        .getElementById('lab-report-file-upload-edit')
                        ?.click()
                    }
                    className="cursor-pointer whitespace-nowrap"
                  >
                    {uploadingEditPdf ? (
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    ) : (
                      <FileUp className="mr-1 h-4 w-4" />
                    )}
                    Upload PDF
                  </Button>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Lab Portal Link / External URL (Optional)</Label>
              <Input
                value={editResultUrl}
                onChange={(e) => setEditResultUrl(e.target.value)}
                placeholder="Link to patient portal result page..."
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Notes (Visible to Patient via WhatsApp)</Label>
              <Input
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Preliminary remarks for the patient..."
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Internal Staff Notes (Private / Staff Only)</Label>
              <Input
                value={editInternalNotes}
                onChange={(e) => setEditInternalNotes(e.target.value)}
                placeholder="Confidential lab notes..."
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditingReportId(null)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={updating}>
              {updating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{' '}
              Save Changes
            </Button>
          </div>
        </form>
      )}

      {/* Tabs */}
      <div className="border-border flex border-b">
        {(['all', 'pending', 'processing', 'ready', 'delivered'] as const).map(
          (tab) => (
            <button
              key={tab}
              onClick={() => setActiveFilter(tab)}
              className={`border-b-2 px-4 py-2 text-sm font-semibold capitalize transition-colors ${
                activeFilter === tab
                  ? 'border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground border-transparent'
              }`}
            >
              {tab}
            </button>
          )
        )}
      </div>

      {/* Lab listing */}
      {filteredReports.length === 0 ? (
        <div className="border-border mx-auto max-w-2xl rounded-xl border border-dashed p-12 text-center">
          <Activity className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
          <h3 className="text-foreground text-lg font-bold">
            No reports recorded
          </h3>
          <p className="text-muted-foreground mt-1 text-sm">
            There are no diagnostic records matching this filter.
          </p>
        </div>
      ) : (
        <div className="bg-card border-border overflow-hidden rounded-xl border">
          <div className="overflow-x-auto">
            <table className="text-muted-foreground w-full text-left text-sm">
              <thead className="bg-muted/50 border-border text-foreground border-b text-xs font-semibold uppercase">
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
              <tbody className="divide-border text-foreground divide-y">
                {filteredReports.map((rep) => {
                  const docData = rep.doctor as
                    | { name?: string }
                    | { name?: string }[]
                    | null;
                  const docName =
                    (Array.isArray(docData)
                      ? docData[0]?.name
                      : docData?.name) || '—';
                  return (
                    <tr
                      key={rep.id}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-6 py-4 font-semibold">
                        <div>
                          <div>{rep.patient?.name || 'Unknown Patient'}</div>
                          <div className="text-muted-foreground text-xs font-normal">
                            {rep.patient?.phone}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-primary font-semibold">
                          {rep.test_name}
                        </div>
                        {rep.notes && (
                          <div className="text-muted-foreground mt-0.5 text-xs font-normal">
                            {rep.notes}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold">
                          {rep.department || 'General'}
                        </div>
                        <div className="text-muted-foreground text-xs font-normal">
                          Ref: Dr. {docName}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {rep.expected_delivery_date
                          ? new Date(
                              rep.expected_delivery_date
                            ).toLocaleDateString()
                          : '—'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {rep.report_pdf_url ? (
                            <a
                              href={rep.report_pdf_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-emerald-600 hover:underline dark:text-emerald-400"
                            >
                              <FileDown className="h-3.5 w-3.5" /> Download
                            </a>
                          ) : (
                            <div className="flex shrink-0 items-center gap-1.5">
                              <span className="text-muted-foreground text-xs">
                                None
                              </span>
                              <div className="relative">
                                <input
                                  type="file"
                                  accept=".pdf,application/pdf"
                                  onChange={(e) =>
                                    handleRowFileUpload(rep.id, e)
                                  }
                                  className="hidden"
                                  id={`row-upload-${rep.id}`}
                                />
                                <Button
                                  size="xs"
                                  variant="ghost"
                                  onClick={() =>
                                    document
                                      .getElementById(`row-upload-${rep.id}`)
                                      ?.click()
                                  }
                                  className="text-primary hover:bg-primary/10 h-6 cursor-pointer px-1.5 text-[10px]"
                                >
                                  Upload
                                </Button>
                              </div>
                            </div>
                          )}

                          <Button
                            size="xs"
                            variant="ghost"
                            onClick={() =>
                              handleTriggerManualNotification(rep.id)
                            }
                            disabled={notifying === rep.id}
                            className="flex h-6 shrink-0 cursor-pointer items-center gap-1 border border-emerald-500/10 px-2 text-[10px] font-bold text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-700"
                            title={
                              rep.notified_patient
                                ? 'Resend via WhatsApp'
                                : 'Send via WhatsApp'
                            }
                          >
                            {notifying === rep.id ? (
                              <Loader2 className="h-2.5 w-2.5 animate-spin" />
                            ) : (
                              <MessageSquare className="h-2.5 w-2.5 text-emerald-500" />
                            )}
                            {rep.notified_patient ? 'Resend WA' : 'Send WA'}
                          </Button>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                            rep.status === 'ready'
                              ? 'bg-emerald-500/10 text-emerald-500'
                              : rep.status === 'processing'
                                ? 'animate-pulse bg-sky-500/10 text-sky-500'
                                : rep.status === 'delivered'
                                  ? 'bg-indigo-500/10 text-indigo-500'
                                  : 'bg-amber-500/10 text-amber-500'
                          }`}
                        >
                          {rep.status}
                        </span>
                      </td>
                      <td className="flex items-center justify-end space-x-1.5 px-6 py-4 text-right">
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => startEditReport(rep)}
                          className="text-muted-foreground hover:text-foreground hover:bg-muted flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg p-0"
                          title="Edit Report Details"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        {rep.status === 'pending' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              handleUpdateStatus(rep.id, 'processing')
                            }
                            className="cursor-pointer border-sky-500/20 bg-sky-500/10 px-2.5 py-1 text-xs text-sky-500 hover:bg-sky-500/20"
                          >
                            Start Processing
                          </Button>
                        )}
                        {rep.status === 'processing' && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={notifying === rep.id}
                            onClick={() => handleUpdateStatus(rep.id, 'ready')}
                            className="cursor-pointer border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-500 hover:bg-emerald-500/20"
                          >
                            {notifying === rep.id ? (
                              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Check className="mr-1 h-3.5 w-3.5" />
                            )}
                            Mark Ready
                          </Button>
                        )}
                        {rep.status === 'ready' && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={notifying === rep.id}
                              onClick={() =>
                                handleTriggerManualNotification(rep.id)
                              }
                              className="cursor-pointer border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400"
                            >
                              {notifying === rep.id ? (
                                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Bell className="mr-1 h-3.5 w-3.5" />
                              )}
                              {rep.notified_patient
                                ? 'Resend WhatsApp'
                                : 'Send WhatsApp'}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                handleUpdateStatus(rep.id, 'delivered')
                              }
                              className="cursor-pointer border-indigo-500/20 bg-indigo-500/10 px-2.5 py-1 text-xs text-indigo-500 hover:bg-indigo-500/20"
                            >
                              Deliver
                            </Button>
                          </>
                        )}
                        {rep.status === 'delivered' && (
                          <span className="text-muted-foreground inline-flex items-center text-xs font-semibold">
                            <Check className="mr-1 h-3.5 w-3.5 text-emerald-500" />{' '}
                            Delivered
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
