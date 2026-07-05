"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BellRing, Loader2, Sparkles, AlertCircle, Clock, FileText } from "lucide-react";
import { toast } from "sonner";

export function ReminderPanel() {
  const { canEditSettings } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // States
  const [enabled, setEnabled] = useState(true);
  const [enable24h, setEnable24h] = useState(true);
  const [enable2h, setEnable2h] = useState(true);
  const [customTime, setCustomTime] = useState<number | "">("");
  const [template, setTemplate] = useState("");
  const [bhEnabled, setBhEnabled] = useState(false);
  const [bhStart, setBhStart] = useState("09:00");
  const [bhEnd, setBhEnd] = useState("17:00");

  useEffect(() => {
    async function loadConfig() {
      try {
        const response = await fetch("/api/account/reminders");
        if (response.ok) {
          const data = await response.json();
          setEnabled(data.reminder_enabled);
          setEnable24h(data.reminder_24h_enabled);
          setEnable2h(data.reminder_2h_enabled);
          setCustomTime(data.reminder_custom_time ?? "");
          setTemplate(data.reminder_template || "");
          
          const bh = data.reminder_business_hours || {};
          setBhEnabled(bh.enabled ?? false);
          setBhStart(bh.start || "09:00");
          setBhEnd(bh.end || "17:00");
        }
      } catch (err) {
        console.error("Failed to load reminder config:", err);
      } finally {
        setLoading(false);
      }
    }
    loadConfig();
  }, []);

  async function handleSave() {
    if (!canEditSettings) return;
    setSaving(true);

    try {
      const response = await fetch("/api/account/reminders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reminder_enabled: enabled,
          reminder_24h_enabled: enable24h,
          reminder_2h_enabled: enable2h,
          reminder_custom_time: customTime === "" ? null : Number(customTime),
          reminder_template: template,
          reminder_business_hours: {
            enabled: bhEnabled,
            start: bhStart,
            end: bhEnd,
          },
        }),
      });

      if (!response.ok) throw new Error(await response.text());
      toast.success("Reminder configuration saved");
    } catch (err) {
      console.error(err);
      toast.error("Failed to save reminder settings");
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

  return (
    <section className="space-y-8 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="flex items-start gap-4 p-6 bg-gradient-to-r from-emerald-500/10 via-background to-background border border-emerald-500/20 rounded-2xl backdrop-blur-xl">
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
          <BellRing className="h-8 w-8 text-emerald-600 dark:text-emerald-400 animate-bounce drop-shadow-[0_0_8px_rgba(16,185,129,0.3)]" />
        </div>
        <div>
          <h2 className="text-xl font-extrabold text-foreground flex items-center gap-2">
            AI Smart Appointment Reminders
            <span className="text-[10px] font-bold tracking-widest uppercase bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/30">
              Active
            </span>
          </h2>
          <p className="text-xs text-muted-foreground mt-1 max-w-xl leading-relaxed">
            Configure automated WhatsApp reminder timelines, custom template placeholders, and business hours constraint logic.
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Step 1: Status & Schedules */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4 hover:border-emerald-500/20 dark:hover:border-emerald-500/30 transition-all duration-300 shadow-md">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-xs font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/30">
              1
            </span>
            <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
              <Clock className="size-4 text-emerald-600 dark:text-emerald-400" />
              Automated Reminder Schedules
            </h3>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="global-enabled"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                disabled={!canEditSettings}
                className="rounded border-border bg-background focus:ring-emerald-500 h-4 w-4 text-emerald-600 cursor-pointer"
              />
              <Label htmlFor="global-enabled" className="text-sm font-bold text-foreground cursor-pointer select-none">
                Enable Automated Reminders Globally
              </Label>
            </div>

            {enabled && (
              <div className="pl-7 space-y-3 border-l-2 border-emerald-100 dark:border-emerald-900/30 animate-in slide-in-from-left-2 duration-200">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="enable-24h"
                    checked={enable24h}
                    onChange={(e) => setEnable24h(e.target.checked)}
                    disabled={!canEditSettings}
                    className="rounded border-border bg-background focus:ring-emerald-500 h-4 w-4 text-emerald-600 cursor-pointer"
                  />
                  <Label htmlFor="enable-24h" className="text-xs text-muted-foreground font-semibold cursor-pointer select-none">
                    Send reminder 24 Hours before appointment
                  </Label>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="enable-2h"
                    checked={enable2h}
                    onChange={(e) => setEnable2h(e.target.checked)}
                    disabled={!canEditSettings}
                    className="rounded border-border bg-background focus:ring-emerald-500 h-4 w-4 text-emerald-600 cursor-pointer"
                  />
                  <Label htmlFor="enable-2h" className="text-xs text-muted-foreground font-semibold cursor-pointer select-none">
                    Send reminder 2 Hours before appointment
                  </Label>
                </div>

                <div className="grid gap-1.5 pt-2 max-w-xs">
                  <Label htmlFor="custom-offset" className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Custom Additional Offset (Minutes)
                  </Label>
                  <Input
                    id="custom-offset"
                    type="number"
                    placeholder="e.g. 60 for 1 hour before"
                    value={customTime}
                    onChange={(e) => setCustomTime(e.target.value === "" ? "" : Number(e.target.value))}
                    disabled={!canEditSettings}
                    className="h-8 text-xs bg-muted/40 border-border focus-visible:ring-emerald-500"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Step 2: Message Template Customize */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4 hover:border-emerald-500/20 dark:hover:border-emerald-500/30 transition-all duration-300 shadow-md">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-xs font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/30">
              2
            </span>
            <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
              <FileText className="size-4 text-emerald-600 dark:text-emerald-400" />
              Reminder Template Settings
            </h3>
          </div>

          <div className="space-y-3">
            <div className="grid gap-1.5">
              <Label htmlFor="reminderTemplate" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Message Content Template
              </Label>
              <Textarea
                id="reminderTemplate"
                placeholder="Write your custom reminder template..."
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                disabled={!canEditSettings}
                rows={9}
                className="max-w-xl bg-muted/40 border-border focus-visible:ring-emerald-500 text-foreground font-normal leading-relaxed text-xs resize-y"
              />
            </div>

            <div className="rounded-xl border border-emerald-200 dark:border-emerald-500/10 bg-emerald-50 dark:bg-emerald-950/10 p-4 text-[11.5px] text-emerald-950 dark:text-emerald-200 space-y-2.5 max-w-xl">
              <p className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                <Sparkles className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                Available Template Variables:
              </p>
              <div className="grid grid-cols-2 gap-2.5 text-[10.5px] text-emerald-900/90 dark:text-emerald-300/90">
                <div><code className="font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-100/60 dark:bg-emerald-900/40 px-1 py-0.5 rounded border border-emerald-200/50 dark:border-emerald-800/30 font-bold">{"{{PatientName}}"}</code> - Patient Name</div>
                <div><code className="font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-100/60 dark:bg-emerald-900/40 px-1 py-0.5 rounded border border-emerald-200/50 dark:border-emerald-800/30 font-bold">{"{{HospitalName}}"}</code> - Hospital Name</div>
                <div><code className="font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-100/60 dark:bg-emerald-900/40 px-1 py-0.5 rounded border border-emerald-200/50 dark:border-emerald-800/30 font-bold">{"{{DoctorName}}"}</code> - Doctor Name</div>
                <div><code className="font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-100/60 dark:bg-emerald-900/40 px-1 py-0.5 rounded border border-emerald-200/50 dark:border-emerald-800/30 font-bold">{"{{Department}}"}</code> - Doctor Department</div>
                <div><code className="font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-100/60 dark:bg-emerald-900/40 px-1 py-0.5 rounded border border-emerald-200/50 dark:border-emerald-800/30 font-bold">{"{{AppointmentDate}}"}</code> - Booking Date</div>
                <div><code className="font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-100/60 dark:bg-emerald-900/40 px-1 py-0.5 rounded border border-emerald-200/50 dark:border-emerald-800/30 font-bold">{"{{AppointmentTime}}"}</code> - Booking Time</div>
                <div><code className="font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-100/60 dark:bg-emerald-900/40 px-1 py-0.5 rounded border border-emerald-200/50 dark:border-emerald-800/30 font-bold">{"{{TokenNumber}}"}</code> - Appointment Token</div>
                <div><code className="font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-100/60 dark:bg-emerald-900/40 px-1 py-0.5 rounded border border-emerald-200/50 dark:border-emerald-800/30 font-bold">{"{{ReminderTime}}"}</code> - Time Left</div>
              </div>
            </div>
          </div>
        </div>

        {/* Step 3: Business Hours */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4 hover:border-emerald-500/20 dark:hover:border-emerald-500/30 transition-all duration-300 shadow-md">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-xs font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/30">
              3
            </span>
            <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
              <Clock className="size-4 text-emerald-600 dark:text-emerald-400" />
              Business Hours Constraint
            </h3>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="bh-enabled"
                checked={bhEnabled}
                onChange={(e) => setBhEnabled(e.target.checked)}
                disabled={!canEditSettings}
                className="rounded border-border bg-background focus:ring-emerald-500 h-4 w-4 text-emerald-600 cursor-pointer"
              />
              <Label htmlFor="bh-enabled" className="text-xs text-muted-foreground font-semibold cursor-pointer select-none">
                Only send WhatsApp reminders during business hours (Avoids disturbing patients at night)
              </Label>
            </div>

            {bhEnabled && (
              <div className="grid grid-cols-2 gap-4 max-w-sm pl-7 animate-in slide-in-from-left-2 duration-200">
                <div className="space-y-1">
                  <Label htmlFor="bh-start" className="text-[10px] font-bold text-muted-foreground uppercase">Start Time</Label>
                  <Input
                    id="bh-start"
                    type="time"
                    value={bhStart}
                    onChange={(e) => setBhStart(e.target.value)}
                    disabled={!canEditSettings}
                    className="h-8 text-xs bg-muted/40"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="bh-end" className="text-[10px] font-bold text-muted-foreground uppercase">End Time</Label>
                  <Input
                    id="bh-end"
                    type="time"
                    value={bhEnd}
                    onChange={(e) => setBhEnd(e.target.value)}
                    disabled={!canEditSettings}
                    className="h-8 text-xs bg-muted/40"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Controls */}
        {canEditSettings ? (
          <div className="flex items-center gap-3">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-emerald-700 dark:bg-emerald-600 hover:bg-emerald-600 dark:hover:bg-emerald-500 text-white font-bold cursor-pointer transition-all duration-200 shadow-md shadow-emerald-600/10"
            >
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-1.5" />
                  Saving Configuration...
                </>
              ) : (
                "Save Reminder Config"
              )}
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">
            You do not have write access to edit Reminder settings.
          </p>
        )}
      </div>
    </section>
  );
}
