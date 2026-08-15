'use client';

import { useState } from 'react';
import {
  FileUp,
  FileText,
  Send,
  Loader2,
  Stethoscope,
  UploadCloud,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';

interface UploadPatientPdfModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  contactId: string;
  patientName: string;
  patientPhone: string;
  onSuccess?: () => void;
}

export function UploadPatientPdfModal({
  open,
  onOpenChange,
  patientId,
  contactId,
  patientName,
  patientPhone,
  onSuccess,
}: UploadPatientPdfModalProps) {
  const [docType, setDocType] = useState<
    'lab_report' | 'prescription' | 'medical_record'
  >('lab_report');
  const [testName, setTestName] = useState('');
  const [department, setDepartment] = useState('Pathology');
  const [file, setFile] = useState<File | null>(null);
  const [autoSend, setAutoSend] = useState(true);
  const [notes, setNotes] = useState('');
  const [uploading, setUploading] = useState(false);

  async function handleUpload() {
    if (!file) {
      toast.error('Please select a PDF document to upload');
      return;
    }
    if (!testName.trim()) {
      toast.error('Document title/test name is required');
      return;
    }

    setUploading(true);

    try {
      // 1. Upload file using unified storage helper
      const { uploadAccountMedia } = await import('@/lib/storage/upload-media');
      const uploadResult = await uploadAccountMedia('chat-media', file);
      const documentUrl = uploadResult.publicUrl;

      // 2. Call backend API to record PDF and auto-send to patient
      const res = await fetch('/api/patients/upload-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_id: contactId,
          doc_type: docType,
          test_name: testName.trim(),
          department,
          report_pdf_url: documentUrl,
          auto_send: autoSend,
          notes: notes.trim(),
        }),
      });

      const resData = await res.json();
      if (!res.ok)
        throw new Error(resData.error || 'Failed to process document');

      toast.success(
        autoSend
          ? `PDF uploaded & dispatched to ${patientName} on WhatsApp!`
          : `PDF uploaded successfully for ${patientName}`
      );

      onOpenChange(false);
      setFile(null);
      setTestName('');
      setNotes('');
      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      console.error('[Upload PDF] Exception:', err);
      toast.error((err as Error).message || 'Failed to upload patient PDF');
    } finally {
      setUploading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2 text-lg font-bold">
            <FileUp className="size-5 text-emerald-500" />
            Upload Patient PDF & Deliver
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {/* Patient Info Banner */}
          <div className="flex items-center justify-between rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-2.5">
            <div>
              <p className="text-foreground font-bold">{patientName}</p>
              <p className="text-muted-foreground font-mono text-[11px]">
                {patientPhone}
              </p>
            </div>
            <span className="rounded bg-emerald-500/20 px-2 py-0.5 font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
              {patientId || 'PAT-000000'}
            </span>
          </div>

          {/* Document Type Selector */}
          <div>
            <Label className="text-foreground font-semibold">
              Document Category *
            </Label>
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              {[
                { id: 'lab_report', label: 'Lab Report', icon: FileText },
                {
                  id: 'prescription',
                  label: 'Prescription',
                  icon: Stethoscope,
                },
                { id: 'medical_record', label: 'Medical Record', icon: FileUp },
              ].map((t) => {
                const Icon = t.icon;
                const active = docType === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setDocType(
                        t.id as 'lab_report' | 'prescription' | 'medical_record'
                      );
                      if (t.id === 'prescription' && !testName)
                        setTestName('Doctor Prescription Slip');
                      if (t.id === 'lab_report' && !testName)
                        setTestName('Diagnostic Lab Test Report');
                    }}
                    className={`flex cursor-pointer flex-col items-center gap-1 rounded-lg border p-2.5 text-center font-medium transition-all ${
                      active
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 shadow-xs dark:text-emerald-400'
                        : 'border-border bg-background text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Icon className="size-4" />
                    <span className="text-[10px]">{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Title & Department */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-foreground font-semibold">
                Document Title / Test *
              </Label>
              <Input
                value={testName}
                onChange={(e) => setTestName(e.target.value)}
                placeholder="e.g. CBC Blood Report"
                className="bg-background border-border mt-1.5 text-xs"
              />
            </div>
            <div>
              <Label className="text-foreground font-semibold">
                Department
              </Label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="bg-background border-border text-foreground focus:ring-primary mt-1.5 w-full rounded-lg border p-2 text-xs focus:ring-1 focus:outline-none"
              >
                <option value="Pathology">Pathology</option>
                <option value="Radiology">Radiology</option>
                <option value="Cardiology">Cardiology</option>
                <option value="General Medicine">General Medicine</option>
                <option value="Orthopedics">Orthopedics</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          {/* PDF File Upload Input */}
          <div>
            <Label className="text-foreground font-semibold">
              Select PDF File *
            </Label>
            <div className="border-border bg-background/50 relative mt-1.5 cursor-pointer rounded-xl border-2 border-dashed p-4 text-center transition-colors hover:border-emerald-500/50">
              <input
                type="file"
                accept=".pdf,application/pdf,image/png,image/jpeg"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
              <UploadCloud className="mx-auto mb-1 size-6 text-emerald-500" />
              {file ? (
                <div>
                  <p className="truncate text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    {file.name}
                  </p>
                  <p className="text-muted-foreground mt-0.5 text-[10px]">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-foreground text-xs font-medium">
                    Click to browse or drop PDF file here
                  </p>
                  <p className="text-muted-foreground mt-0.5 text-[10px]">
                    PDF, PNG, JPG (Max 15 MB)
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Auto-send WhatsApp Checkbox */}
          <div className="bg-muted/40 border-border/40 flex items-center gap-2 rounded-lg border p-2.5">
            <Checkbox
              id="autosend-whatsapp"
              checked={autoSend}
              onCheckedChange={(c) => setAutoSend(!!c)}
              className="data-[state=checked]:bg-emerald-500"
            />
            <label
              htmlFor="autosend-whatsapp"
              className="text-foreground flex cursor-pointer items-center gap-1.5 text-xs font-semibold"
            >
              <Send className="size-3 text-emerald-500" />
              Auto-send PDF to patient&apos;s WhatsApp instantly
            </label>
          </div>

          {/* Notes */}
          <div>
            <Label className="text-foreground font-semibold">
              Staff Notes (Optional)
            </Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Report reviewed by Dr. Susanta. Patient advised for follow-up in 7 days."
              className="bg-background border-border mt-1.5 text-xs"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={uploading}
            onClick={handleUpload}
            className="cursor-pointer gap-1.5 bg-emerald-600 font-semibold text-white hover:bg-emerald-700"
          >
            {uploading ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Uploading...
              </>
            ) : (
              <>
                <FileUp className="size-4" /> Upload & Send PDF
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
