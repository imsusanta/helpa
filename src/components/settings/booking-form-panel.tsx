'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  FileText,
  CheckCircle2,
  Loader2,
  Sparkles,
  ShieldCheck,
  Eye,
  Sliders,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { DEFAULT_BOOKING_FORM_CONFIG } from '@/app/api/account/booking-form/route';

interface FieldMeta {
  key: string;
  label: string;
  category: 'primary' | 'patient_info' | 'guardian' | 'clinical' | 'insurance';
  description: string;
}

const ALL_BOOKING_FIELDS: FieldMeta[] = [
  { key: 'name', label: 'Patient Name', category: 'primary', description: 'Full name of the patient (Mandatory Default)' },
  { key: 'phone', label: 'Mobile Number', category: 'primary', description: 'Primary contact & WhatsApp number (Mandatory Default)' },
  { key: 'age', label: 'Age', category: 'patient_info', description: 'Patient age in years' },
  { key: 'gender', label: 'Gender', category: 'patient_info', description: 'Male, Female, or Other' },
  { key: 'dob', label: 'Date of Birth', category: 'patient_info', description: 'Exact birth date (YYYY-MM-DD)' },
  { key: 'address', label: 'Address', category: 'patient_info', description: 'Residential location / city' },
  { key: 'blood_group', label: 'Blood Group', category: 'patient_info', description: 'A+, B+, O+, AB+, etc.' },
  { key: 'emergency_contact', label: 'Emergency Contact', category: 'patient_info', description: 'ICE contact name & mobile' },
  { key: 'guardian_name', label: 'Guardian Name', category: 'guardian', description: 'Parent or legal guardian name' },
  { key: 'guardian_mobile', label: 'Guardian Mobile', category: 'guardian', description: 'Parent or legal guardian mobile' },
  { key: 'email', label: 'Email Address', category: 'patient_info', description: 'Patient email ID for digital invoices' },
  { key: 'doctor_id', label: 'Preferred Doctor', category: 'clinical', description: 'Attending consultant doctor' },
  { key: 'department', label: 'Department', category: 'clinical', description: 'Cardiology, Orthopedics, OPD, etc.' },
  { key: 'appointment_type', label: 'Appointment Type', category: 'clinical', description: 'New Consultation, Follow-up, Check-up' },
  { key: 'reason_for_visit', label: 'Reason for Visit', category: 'clinical', description: 'Primary chief complaint or symptoms' },
  { key: 'insurance_provider', label: 'Insurance Provider', category: 'insurance', description: 'TPA / Health Insurance company' },
  { key: 'insurance_number', label: 'Insurance Policy Number', category: 'insurance', description: 'Policy or TPA Card ID' },
  { key: 'referred_by', label: 'Referred By', category: 'clinical', description: 'Referring doctor or channel' },
  { key: 'notes', label: 'Internal Staff Notes', category: 'clinical', description: 'Receptionist & triage notes' },
];

export function BookingFormPanel() {
  const { canEditSettings } = useAuth();
  const [config, setConfig] = useState<Record<string, { show: boolean; required: boolean }>>(DEFAULT_BOOKING_FORM_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadConfig() {
      try {
        const res = await fetch('/api/account/booking-form');
        if (res.ok) {
          const data = await res.json();
          if (data.config) {
            setConfig({
              ...DEFAULT_BOOKING_FORM_CONFIG,
              ...data.config,
              name: { show: true, required: true },
              phone: { show: true, required: true },
            });
          }
        }
      } catch (err) {
        console.error('Failed to load booking form config:', err);
      } finally {
        setLoading(false);
      }
    }

    loadConfig();
  }, []);

  function handleToggleShow(key: string, show: boolean) {
    if (key === 'name' || key === 'phone') return; // Cannot hide mandatory default fields
    setConfig((prev) => {
      const current = prev[key] || { show: false, required: false };
      return {
        ...prev,
        [key]: {
          show,
          // If hiding the field, automatically uncheck required
          required: show ? current.required : false,
        },
      };
    });
  }

  function handleToggleRequired(key: string, required: boolean) {
    if (key === 'name' || key === 'phone') return; // Cannot unrequire mandatory default fields
    setConfig((prev) => {
      const current = prev[key] || { show: false, required: false };
      // Only allow marking required if show is true
      if (!current.show && required) return prev;
      return {
        ...prev,
        [key]: {
          ...current,
          required,
        },
      };
    });
  }

  function applyPreset(presetType: 'minimal' | 'clinical' | 'full') {
    if (presetType === 'minimal') {
      const minimal: Record<string, { show: boolean; required: boolean }> = {};
      ALL_BOOKING_FIELDS.forEach((f) => {
        if (f.key === 'name' || f.key === 'phone') {
          minimal[f.key] = { show: true, required: true };
        } else if (f.key === 'doctor_id' || f.key === 'department') {
          minimal[f.key] = { show: true, required: false };
        } else {
          minimal[f.key] = { show: false, required: false };
        }
      });
      setConfig(minimal);
      toast.info('Applied Fast Receptionist Mode preset');
    } else if (presetType === 'clinical') {
      const clinical: Record<string, { show: boolean; required: boolean }> = {};
      ALL_BOOKING_FIELDS.forEach((f) => {
        if (f.key === 'name' || f.key === 'phone' || f.key === 'doctor_id' || f.key === 'department') {
          clinical[f.key] = { show: true, required: true };
        } else if (['age', 'gender', 'dob', 'address', 'blood_group', 'reason_for_visit', 'notes'].includes(f.key)) {
          clinical[f.key] = { show: true, required: false };
        } else {
          clinical[f.key] = { show: false, required: false };
        }
      });
      setConfig(clinical);
      toast.info('Applied Standard OPD Triage preset');
    } else if (presetType === 'full') {
      const full: Record<string, { show: boolean; required: boolean }> = {};
      ALL_BOOKING_FIELDS.forEach((f) => {
        if (f.key === 'name' || f.key === 'phone') {
          full[f.key] = { show: true, required: true };
        } else {
          full[f.key] = { show: true, required: false };
        }
      });
      setConfig(full);
      toast.info('Applied Full Registration preset');
    }
  }

  async function handleSave() {
    if (!canEditSettings) return;
    setSaving(true);

    try {
      const response = await fetch('/api/account/booking-form', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      toast.success('Appointment booking form configuration saved!');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save booking form settings');
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="size-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  const enabledFieldsCount = Object.values(config).filter((f) => f.show).length;
  const requiredFieldsCount = Object.values(config).filter((f) => f.show && f.required).length;

  return (
    <section className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-start gap-4 p-6 bg-gradient-to-r from-emerald-500/10 via-background to-background border border-emerald-500/20 rounded-2xl backdrop-blur-xl">
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
          <FileText className="h-8 w-8 text-emerald-600 dark:text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.3)]" />
        </div>
        <div>
          <h2 className="text-xl font-extrabold text-foreground flex items-center gap-2">
            Appointment Booking Form Settings
            <span className="text-[10px] font-bold tracking-widest uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20">
              Form Builder
            </span>
          </h2>
          <p className="text-xs text-muted-foreground mt-1 max-w-xl leading-relaxed">
            Customize which fields appear during appointment booking. By default, only <strong>Patient Name</strong> & <strong>Mobile Number</strong> are mandatory for super-fast reception booking.
          </p>
        </div>
      </div>

      {/* Main Settings Card */}
      <div className="bg-card border border-border rounded-2xl p-6 space-y-6 shadow-md">
        {/* Top Controls & Presets */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-muted/30 border border-border rounded-xl">
          <div className="flex items-center gap-4 text-xs font-semibold text-foreground">
            <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
              <Eye className="size-4" /> {enabledFieldsCount} Visible Fields
            </span>
            <span className="text-border">|</span>
            <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-bold">
              <ShieldCheck className="size-4" /> {requiredFieldsCount} Mandatory Required
            </span>
          </div>

          {canEditSettings && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-muted-foreground flex items-center gap-1">
                <Sparkles className="size-3 text-emerald-600 dark:text-emerald-400" /> Quick Presets:
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-[11px] h-7 cursor-pointer border-border hover:border-emerald-500/40"
                onClick={() => applyPreset('minimal')}
              >
                ⚡ Fast Mode (2 Required)
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-[11px] h-7 cursor-pointer border-border hover:border-emerald-500/40"
                onClick={() => applyPreset('clinical')}
              >
                🏥 Standard OPD Triage
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-[11px] h-7 cursor-pointer border-border hover:border-emerald-500/40"
                onClick={() => applyPreset('full')}
              >
                📋 Full Registration
              </Button>
            </div>
          )}
        </div>

        {/* Mandatory Defaults Banner */}
        <div className="flex items-start gap-3 p-3.5 bg-sky-500/10 border border-sky-500/20 rounded-xl text-xs text-sky-800 dark:text-sky-300">
          <AlertCircle className="size-4 text-sky-600 dark:text-sky-400 mt-0.5 shrink-0" />
          <p className="leading-relaxed">
            <strong>Mandatory Default Rule:</strong> <strong>Patient Name</strong> & <strong>Mobile Number</strong> are enabled and required by default for every hospital workspace to guarantee 5-second booking.
          </p>
        </div>

        {/* Interactive Field Settings List */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Sliders className="size-3.5 text-emerald-500" />
            Configurable Form Fields (19 Fields Available)
          </h3>

          <div className="divide-y divide-border/60 border border-border rounded-xl overflow-hidden bg-background">
            {ALL_BOOKING_FIELDS.map((f) => {
              const fieldCfg = config[f.key] || { show: false, required: false };
              const isMandatoryDefault = f.key === 'name' || f.key === 'phone';

              return (
                <div
                  key={f.key}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between p-3.5 gap-3 transition-colors ${
                    fieldCfg.show ? 'bg-card' : 'bg-muted/20 opacity-75'
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-foreground">{f.label}</span>
                      {isMandatoryDefault && (
                        <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          Mandatory Default
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground">{f.description}</p>
                  </div>

                  <div className="flex items-center gap-6 self-end sm:self-auto">
                    {/* Show Field Switch */}
                    <div className="flex items-center gap-2">
                      <Switch
                        id={`show-${f.key}`}
                        checked={fieldCfg.show}
                        onCheckedChange={(val) => handleToggleShow(f.key, val)}
                        disabled={!canEditSettings || isMandatoryDefault}
                        className="data-[state=checked]:bg-emerald-600"
                      />
                      <label htmlFor={`show-${f.key}`} className="text-xs text-muted-foreground font-medium cursor-pointer">
                        Show Field
                      </label>
                    </div>

                    {/* Required Field Switch */}
                    <div className="flex items-center gap-2">
                      <Switch
                        id={`req-${f.key}`}
                        checked={fieldCfg.required}
                        onCheckedChange={(val) => handleToggleRequired(f.key, val)}
                        disabled={!canEditSettings || isMandatoryDefault || !fieldCfg.show}
                        className="data-[state=checked]:bg-amber-600"
                      />
                      <label
                        htmlFor={`req-${f.key}`}
                        className={`text-xs font-medium cursor-pointer ${
                          !fieldCfg.show ? 'text-muted-foreground/40' : fieldCfg.required ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-muted-foreground'
                        }`}
                      >
                        Required
                      </label>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Button */}
        {canEditSettings ? (
          <div className="pt-2">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-emerald-700 dark:bg-emerald-600 hover:bg-emerald-600 dark:hover:bg-emerald-500 text-white font-bold cursor-pointer transition-all duration-200 shadow-md shadow-emerald-600/10"
            >
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-1.5" />
                  Saving Form Settings...
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-4 mr-1.5" />
                  Save Booking Form Configuration
                </>
              )}
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">
            You do not have write permissions to edit booking form settings.
          </p>
        )}
      </div>
    </section>
  );
}
