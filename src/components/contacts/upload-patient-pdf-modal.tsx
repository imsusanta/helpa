'use client';

import { useState } from 'react';
import {
  FileUp,
  FileText,
  Send,
  Loader2,
  CheckCircle2,
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
import { createClient } from '@/lib/supabase/client';

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
  const [docType, setDocType] = useState<'lab_report' | 'prescription' | 'medical_record'>('lab_report');
  const [testName, setTestName] = useState('');
  const [department, setDepartment] = useState('Pathology');
  const [file, setFile] = useState<File | null>(null);
  const [autoSend, setAutoSend] = useState(true);
  const [notes, setNotes] = useState('');
  const [uploading, setUploading] = useState(false);

  const supabase = createClient();

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
      // 1. Upload file to Supabase Storage
      const fileExt = file.name.split('.').pop() || 'pdf';
      const fileName = `${contactId}_${Date.now()}.${fileExt}`;
      const filePath = `patient-docs/${fileName}`;

      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from('chat-media')
        .upload(filePath, file, { upsert: true });

      if (uploadErr) {
        throw new Error(`Upload failed: ${uploadErr.message}`);
      }

      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from('chat-media')
        .getPublicUrl(filePath);

      const documentUrl = publicUrlData.publicUrl;

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
      if (!res.ok) throw new Error(resData.error || 'Failed to process document');

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
    } catch (err: any) {
      console.error('[Upload PDF] Exception:', err);
      toast.error(err.message || 'Failed to upload patient PDF');
    } finally {
      setUploading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
            <FileUp className="size-5 text-emerald-500" />
            Upload Patient PDF & Deliver
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {/* Patient Info Banner */}
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2.5 flex items-center justify-between">
            <div>
              <p className="font-bold text-foreground">{patientName}</p>
              <p className="text-[11px] text-muted-foreground font-mono">{patientPhone}</p>
            </div>
            <span className="font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded">
              {patientId || 'PAT-000000'}
            </span>
          </div>

          {/* Document Type Selector */}
          <div>
            <Label className="text-foreground font-semibold">Document Category *</Label>
            <div className="grid grid-cols-3 gap-2 mt-1.5">
              {[
                { id: 'lab_report', label: 'Lab Report', icon: FileText },
                { id: 'prescription', label: 'Prescription', icon: Stethoscope },
                { id: 'medical_record', label: 'Medical Record', icon: FileUp },
              ].map((t) => {
                const Icon = t.icon;
                const active = docType === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setDocType(t.id as any);
                      if (t.id === 'prescription' && !testName) setTestName('Doctor Prescription Slip');
                      if (t.id === 'lab_report' && !testName) setTestName('Diagnostic Lab Test Report');
                    }}
                    className={`p-2.5 rounded-lg border text-center font-medium transition-all cursor-pointer flex flex-col items-center gap-1 ${
                      active
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shadow-xs'
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
              <Label className="text-foreground font-semibold">Document Title / Test *</Label>
              <Input
                value={testName}
                onChange={(e) => setTestName(e.target.value)}
                placeholder="e.g. CBC Blood Report"
                className="mt-1.5 bg-background border-border text-xs"
              />
            </div>
            <div>
              <Label className="text-foreground font-semibold">Department</Label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full mt-1.5 bg-background border border-border rounded-lg p-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
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
            <Label className="text-foreground font-semibold">Select PDF File *</Label>
            <div className="mt-1.5 border-2 border-dashed border-border hover:border-emerald-500/50 rounded-xl p-4 text-center bg-background/50 transition-colors cursor-pointer relative">
              <input
                type="file"
                accept=".pdf,application/pdf,image/png,image/jpeg"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
              <UploadCloud className="size-6 text-emerald-500 mx-auto mb-1" />
              {file ? (
                <div>
                  <p className="font-semibold text-emerald-600 dark:text-emerald-400 text-xs truncate">{file.name}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
              ) : (
                <div>
                  <p className="font-medium text-foreground text-xs">Click to browse or drop PDF file here</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">PDF, PNG, JPG (Max 15 MB)</p>
                </div>
              )}
            </div>
          </div>

          {/* Auto-send WhatsApp Checkbox */}
          <div className="flex items-center gap-2 bg-muted/40 p-2.5 rounded-lg border border-border/40">
            <Checkbox
              id="autosend-whatsapp"
              checked={autoSend}
              onCheckedChange={(c) => setAutoSend(!!c)}
              className="data-[state=checked]:bg-emerald-500"
            />
            <label htmlFor="autosend-whatsapp" className="text-xs font-semibold text-foreground cursor-pointer flex items-center gap-1.5">
              <Send className="size-3 text-emerald-500" />
              Auto-send PDF to patient's WhatsApp instantly
            </label>
          </div>

          {/* Notes */}
          <div>
            <Label className="text-foreground font-semibold">Staff Notes (Optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Report reviewed by Dr. Susanta. Patient advised for follow-up in 7 days."
              className="mt-1.5 bg-background border-border text-xs"
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
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1.5 cursor-pointer"
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
