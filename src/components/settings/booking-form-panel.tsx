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
import { useWorkspace } from '@/hooks/use-workspace';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  getBookingFieldsForIndustry,
  getDefaultBookingFormConfig,
  isClinicBookingIndustry,
  isTravelBookingIndustry,
  mergeBookingFormConfig,
  type BookingFormConfig,
} from '@/lib/booking-form/config';

export function BookingFormPanel() {
  const { canEditSettings } = useAuth();
  const { currentIndustry, terminology } = useWorkspace();
  const industryFields = getBookingFieldsForIndustry(currentIndustry);
  const isClinical = isClinicBookingIndustry(currentIndustry);
  const isTravel = isTravelBookingIndustry(currentIndustry);
  const [config, setConfig] = useState<BookingFormConfig>(
    getDefaultBookingFormConfig(currentIndustry)
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadConfig() {
      try {
        const res = await fetch('/api/account/booking-form');
        if (res.ok) {
          const data = await res.json();
          if (data.config) {
            setConfig(mergeBookingFormConfig(currentIndustry, data.config));
          } else {
            setConfig(getDefaultBookingFormConfig(currentIndustry));
          }
        }
      } catch (err) {
        console.error('Failed to load booking form config:', err);
      } finally {
        setLoading(false);
      }
    }

    loadConfig();
  }, [currentIndustry]);

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

  function applyPreset(presetType: 'minimal' | 'standard' | 'full') {
    const next: BookingFormConfig = {};
    industryFields.forEach((f) => {
      if (f.key === 'name' || f.key === 'phone') {
        next[f.key] = { show: true, required: true };
      } else if (presetType === 'full') {
        next[f.key] = { show: true, required: false };
      } else if (presetType === 'standard') {
        next[f.key] = { show: true, required: f.category === 'schedule' };
      } else {
        next[f.key] = {
          show: f.category === 'primary' || f.category === 'schedule',
          required: f.key === 'name' || f.key === 'phone',
        };
      }
    });
    setConfig(mergeBookingFormConfig(currentIndustry, next));
    toast.info(
      presetType === 'minimal'
        ? 'Applied fast booking preset'
        : presetType === 'standard'
          ? isClinical
            ? 'Applied standard OPD triage preset'
            : `Applied standard ${terminology.booking.toLowerCase()} preset`
          : 'Applied full form preset'
    );
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

      toast.success(`${terminology.booking} form configuration saved!`);
    } catch (err: unknown) {
      toast.error(
        (err as Error).message || 'Failed to save booking form settings'
      );
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
  const requiredFieldsCount = Object.values(config).filter(
    (f) => f.show && f.required
  ).length;

  return (
    <section className="animate-in fade-in space-y-8 duration-300">
      {/* Header */}
      <div className="via-background to-background flex items-start gap-4 rounded-2xl border border-emerald-500/20 bg-gradient-to-r from-emerald-500/10 p-6 backdrop-blur-xl">
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3">
          <FileText className="h-8 w-8 text-emerald-600 drop-shadow-[0_0_8px_rgba(16,185,129,0.3)] dark:text-emerald-400" />
        </div>
        <div>
          <h2 className="text-foreground flex items-center gap-2 text-xl font-extrabold">
            {terminology.booking} Form Settings
            <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold tracking-widest text-emerald-600 uppercase dark:text-emerald-400">
              Form Builder
            </span>
          </h2>
          <p className="text-muted-foreground mt-1 max-w-xl text-xs leading-relaxed">
            Customize which fields appear when staff create a{' '}
            {terminology.booking.toLowerCase()}. Name and mobile stay required
            so bookings can be created quickly.
          </p>
        </div>
      </div>

      {/* Main Settings Card */}
      <div className="bg-card border-border space-y-6 rounded-2xl border p-6 shadow-md">
        {/* Top Controls & Presets */}
        <div className="bg-muted/30 border-border flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4">
          <div className="text-foreground flex items-center gap-4 text-xs font-semibold">
            <span className="flex items-center gap-1.5 font-bold text-emerald-600 dark:text-emerald-400">
              <Eye className="size-4" /> {enabledFieldsCount} Visible Fields
            </span>
            <span className="text-border">|</span>
            <span className="flex items-center gap-1.5 font-bold text-amber-600 dark:text-amber-400">
              <ShieldCheck className="size-4" /> {requiredFieldsCount} Mandatory
              Required
            </span>
          </div>

          {canEditSettings && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground flex items-center gap-1 text-[11px] font-bold">
                <Sparkles className="size-3 text-emerald-600 dark:text-emerald-400" />{' '}
                Quick Presets:
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-border h-7 cursor-pointer text-[11px] hover:border-emerald-500/40"
                onClick={() => applyPreset('minimal')}
              >
                ⚡ Fast Mode (2 Required)
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-border h-7 cursor-pointer text-[11px] hover:border-emerald-500/40"
                onClick={() => applyPreset('standard')}
              >
                {isClinical
                  ? '🏥 Standard OPD Triage'
                  : isTravel
                    ? '✈️ Standard Trip'
                    : `Standard ${terminology.booking}`}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-border h-7 cursor-pointer text-[11px] hover:border-emerald-500/40"
                onClick={() => applyPreset('full')}
              >
                📋 Full Registration
              </Button>
            </div>
          )}
        </div>

        {/* Mandatory Defaults Banner */}
        <div className="flex items-start gap-3 rounded-xl border border-sky-500/20 bg-sky-500/10 p-3.5 text-xs text-sky-800 dark:text-sky-300">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-sky-600 dark:text-sky-400" />
          <p className="leading-relaxed">
            <strong>Mandatory Default Rule:</strong>{' '}
            <strong>{terminology.person} Name</strong> &{' '}
            <strong>Mobile Number</strong> stay enabled and required so staff
            can create a {terminology.booking.toLowerCase()} in a few seconds.
          </p>
        </div>

        {/* Interactive Field Settings List */}
        <div className="space-y-3">
          <h3 className="text-muted-foreground flex items-center gap-1.5 text-xs font-bold tracking-wider uppercase">
            <Sliders className="size-3.5 text-emerald-500" />
            Configurable Form Fields ({industryFields.length} available)
          </h3>

          <div className="divide-border/60 border-border bg-background divide-y overflow-hidden rounded-xl border">
            {industryFields.map((f) => {
              const fieldCfg = config[f.key] || {
                show: false,
                required: false,
              };
              const isMandatoryDefault = f.key === 'name' || f.key === 'phone';

              return (
                <div
                  key={f.key}
                  className={`flex flex-col justify-between gap-3 p-3.5 transition-colors sm:flex-row sm:items-center ${
                    fieldCfg.show ? 'bg-card' : 'bg-muted/20 opacity-75'
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-foreground text-xs font-bold">
                        {f.label}
                      </span>
                      {isMandatoryDefault && (
                        <span className="py-0.2 rounded border border-emerald-500/20 bg-emerald-500/10 px-1.5 text-[9px] font-bold tracking-wider text-emerald-600 uppercase dark:text-emerald-400">
                          Mandatory Default
                        </span>
                      )}
                    </div>
                    <p className="text-muted-foreground text-[11px]">
                      {f.description}
                    </p>
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
                      <label
                        htmlFor={`show-${f.key}`}
                        className="text-muted-foreground cursor-pointer text-xs font-medium"
                      >
                        Show Field
                      </label>
                    </div>

                    {/* Required Field Switch */}
                    <div className="flex items-center gap-2">
                      <Switch
                        id={`req-${f.key}`}
                        checked={fieldCfg.required}
                        onCheckedChange={(val) =>
                          handleToggleRequired(f.key, val)
                        }
                        disabled={
                          !canEditSettings ||
                          isMandatoryDefault ||
                          !fieldCfg.show
                        }
                        className="data-[state=checked]:bg-amber-600"
                      />
                      <label
                        htmlFor={`req-${f.key}`}
                        className={`cursor-pointer text-xs font-medium ${
                          !fieldCfg.show
                            ? 'text-muted-foreground/40'
                            : fieldCfg.required
                              ? 'font-bold text-amber-600 dark:text-amber-400'
                              : 'text-muted-foreground'
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
              className="cursor-pointer bg-emerald-700 font-bold text-white shadow-md shadow-emerald-600/10 transition-all duration-200 hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-500"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-1.5 size-4 animate-spin" />
                  Saving Form Settings...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-1.5 size-4" />
                  Save Booking Form Configuration
                </>
              )}
            </Button>
          </div>
        ) : (
          <p className="text-muted-foreground text-xs italic">
            You do not have write permissions to edit booking form settings.
          </p>
        )}
      </div>
    </section>
  );
}
