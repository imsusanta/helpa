'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { BellRing, Loader2, Sparkles, Clock, FileText } from 'lucide-react';
import { toast } from 'sonner';

/* ------------------------------------------------------------------ */
/*  Industry-aware context for reminder copy                           */
/* ------------------------------------------------------------------ */

interface ReminderContext {
  /** e.g. "Appointment", "Booking", "Session", "Reservation" */
  eventType: string;
  /** e.g. "patients", "students", "clients", "members", "guests" */
  personPlural: string;
  /** Template variables shown in the helper box */
  templateVars: { code: string; desc: string }[];
}

const REMINDER_CTX: Record<string, ReminderContext> = {
  health: {
    eventType: 'Appointment',
    personPlural: 'patients',
    templateVars: [
      { code: '{{PatientName}}', desc: 'Patient Name' },
      { code: '{{HospitalName}}', desc: 'Hospital Name' },
      { code: '{{DoctorName}}', desc: 'Doctor Name' },
      { code: '{{Department}}', desc: 'Doctor Department' },
      { code: '{{AppointmentDate}}', desc: 'Booking Date' },
      { code: '{{AppointmentTime}}', desc: 'Booking Time' },
      { code: '{{TokenNumber}}', desc: 'Appointment Token' },
      { code: '{{ReminderTime}}', desc: 'Time Left' },
    ],
  },
  hospital_clinic: {
    eventType: 'Appointment',
    personPlural: 'patients',
    templateVars: [
      { code: '{{PatientName}}', desc: 'Patient Name' },
      { code: '{{HospitalName}}', desc: 'Hospital Name' },
      { code: '{{DoctorName}}', desc: 'Doctor Name' },
      { code: '{{Department}}', desc: 'Doctor Department' },
      { code: '{{AppointmentDate}}', desc: 'Booking Date' },
      { code: '{{AppointmentTime}}', desc: 'Booking Time' },
      { code: '{{TokenNumber}}', desc: 'Appointment Token' },
      { code: '{{ReminderTime}}', desc: 'Time Left' },
    ],
  },
  coaching: {
    eventType: 'Session',
    personPlural: 'students',
    templateVars: [
      { code: '{{StudentName}}', desc: 'Student Name' },
      { code: '{{InstituteName}}', desc: 'Institute Name' },
      { code: '{{TeacherName}}', desc: 'Teacher Name' },
      { code: '{{CourseName}}', desc: 'Course Name' },
      { code: '{{SessionDate}}', desc: 'Session Date' },
      { code: '{{SessionTime}}', desc: 'Session Time' },
      { code: '{{ReminderTime}}', desc: 'Time Left' },
    ],
  },
  real_estate: {
    eventType: 'Site Visit',
    personPlural: 'clients',
    templateVars: [
      { code: '{{ClientName}}', desc: 'Client Name' },
      { code: '{{AgencyName}}', desc: 'Agency Name' },
      { code: '{{AgentName}}', desc: 'Agent Name' },
      { code: '{{PropertyName}}', desc: 'Property Name' },
      { code: '{{VisitDate}}', desc: 'Visit Date' },
      { code: '{{VisitTime}}', desc: 'Visit Time' },
      { code: '{{ReminderTime}}', desc: 'Time Left' },
    ],
  },
  travel: {
    eventType: 'Booking',
    personPlural: 'travelers',
    templateVars: [
      { code: '{{TravelerName}}', desc: 'Traveler Name' },
      { code: '{{AgencyName}}', desc: 'Agency Name' },
      { code: '{{PackageName}}', desc: 'Package Name' },
      { code: '{{TravelDate}}', desc: 'Travel Date' },
      { code: '{{DepartureTime}}', desc: 'Departure Time' },
      { code: '{{ReminderTime}}', desc: 'Time Left' },
    ],
  },
  gym: {
    eventType: 'Session',
    personPlural: 'members',
    templateVars: [
      { code: '{{MemberName}}', desc: 'Member Name' },
      { code: '{{GymName}}', desc: 'Gym Name' },
      { code: '{{TrainerName}}', desc: 'Trainer Name' },
      { code: '{{ClassName}}', desc: 'Class Name' },
      { code: '{{SessionDate}}', desc: 'Session Date' },
      { code: '{{SessionTime}}', desc: 'Session Time' },
      { code: '{{ReminderTime}}', desc: 'Time Left' },
    ],
  },
  restaurant: {
    eventType: 'Reservation',
    personPlural: 'guests',
    templateVars: [
      { code: '{{GuestName}}', desc: 'Guest Name' },
      { code: '{{RestaurantName}}', desc: 'Restaurant Name' },
      { code: '{{TableNumber}}', desc: 'Table Number' },
      { code: '{{ReservationDate}}', desc: 'Reservation Date' },
      { code: '{{ReservationTime}}', desc: 'Reservation Time' },
      { code: '{{PartySize}}', desc: 'Party Size' },
      { code: '{{ReminderTime}}', desc: 'Time Left' },
    ],
  },
  solo_teacher: {
    eventType: 'Class',
    personPlural: 'students',
    templateVars: [
      { code: '{{StudentName}}', desc: 'Student Name' },
      { code: '{{TeacherName}}', desc: 'Teacher Name' },
      { code: '{{CourseName}}', desc: 'Course Name' },
      { code: '{{BatchName}}', desc: 'Batch Name' },
      { code: '{{ClassDate}}', desc: 'Class Date' },
      { code: '{{ClassTime}}', desc: 'Class Time' },
      { code: '{{ReminderTime}}', desc: 'Time Left' },
    ],
  },
};

const DEFAULT_CTX: ReminderContext = {
  eventType: 'Event',
  personPlural: 'contacts',
  templateVars: [
    { code: '{{ContactName}}', desc: 'Contact Name' },
    { code: '{{BusinessName}}', desc: 'Business Name' },
    { code: '{{EventDate}}', desc: 'Event Date' },
    { code: '{{EventTime}}', desc: 'Event Time' },
    { code: '{{ReminderTime}}', desc: 'Time Left' },
  ],
};

export function ReminderPanel() {
  const { canEditSettings, account } = useAuth();
  const ctx = useMemo(
    () => REMINDER_CTX[account?.industry ?? ''] || DEFAULT_CTX,
    [account?.industry]
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // States
  const [enabled, setEnabled] = useState(true);
  const [enable24h, setEnable24h] = useState(true);
  const [enable2h, setEnable2h] = useState(true);
  const [customTime, setCustomTime] = useState<number | ''>('');
  const [template, setTemplate] = useState('');
  const [bhEnabled, setBhEnabled] = useState(false);
  const [bhStart, setBhStart] = useState('09:00');
  const [bhEnd, setBhEnd] = useState('17:00');

  useEffect(() => {
    async function loadConfig() {
      try {
        const response = await fetch('/api/account/reminders');
        if (response.ok) {
          const data = await response.json();
          setEnabled(data.reminder_enabled);
          setEnable24h(data.reminder_24h_enabled);
          setEnable2h(data.reminder_2h_enabled);
          setCustomTime(data.reminder_custom_time ?? '');
          setTemplate(data.reminder_template || '');

          const bh = data.reminder_business_hours || {};
          setBhEnabled(bh.enabled ?? false);
          setBhStart(bh.start || '09:00');
          setBhEnd(bh.end || '17:00');
        }
      } catch (err) {
        console.error('Failed to load reminder config:', err);
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
      const response = await fetch('/api/account/reminders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reminder_enabled: enabled,
          reminder_24h_enabled: enable24h,
          reminder_2h_enabled: enable2h,
          reminder_custom_time: customTime === '' ? null : Number(customTime),
          reminder_template: template,
          reminder_business_hours: {
            enabled: bhEnabled,
            start: bhStart,
            end: bhEnd,
          },
        }),
      });

      if (!response.ok) throw new Error(await response.text());
      toast.success('Reminder configuration saved');
    } catch (err) {
      console.error(err);
      toast.error('Failed to save reminder settings');
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
    <section className="animate-in fade-in space-y-8 duration-300">
      {/* Header Banner */}
      <div className="via-background to-background flex items-start gap-4 rounded-2xl border border-emerald-500/20 bg-gradient-to-r from-emerald-500/10 p-6 backdrop-blur-xl">
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3">
          <BellRing className="h-8 w-8 animate-bounce text-emerald-600 drop-shadow-[0_0_8px_rgba(16,185,129,0.3)] dark:text-emerald-400" />
        </div>
        <div>
          <h2 className="text-foreground flex items-center gap-2 text-xl font-extrabold">
            AI Smart {ctx.eventType} Reminders
            <span className="rounded-full border border-emerald-200 bg-emerald-100 px-2 py-0.5 text-[10px] font-bold tracking-widest text-emerald-800 uppercase dark:border-emerald-800/30 dark:bg-emerald-950/40 dark:text-emerald-300">
              Active
            </span>
          </h2>
          <p className="text-muted-foreground mt-1 max-w-xl text-xs leading-relaxed">
            Configure automated WhatsApp reminder timelines, custom template
            placeholders, and business hours constraint logic.
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Step 1: Status & Schedules */}
        <div className="bg-card border-border space-y-4 rounded-2xl border p-6 shadow-md transition-all duration-300 hover:border-emerald-500/20 dark:hover:border-emerald-500/30">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full border border-emerald-200 bg-emerald-100 text-xs font-bold text-emerald-700 dark:border-emerald-800/30 dark:bg-emerald-950/40 dark:text-emerald-300">
              1
            </span>
            <h3 className="text-foreground flex items-center gap-1.5 text-sm font-bold">
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
                className="border-border bg-background h-4 w-4 cursor-pointer rounded text-emerald-600 focus:ring-emerald-500"
              />
              <Label
                htmlFor="global-enabled"
                className="text-foreground cursor-pointer text-sm font-bold select-none"
              >
                Enable Automated Reminders Globally
              </Label>
            </div>

            {enabled && (
              <div className="animate-in slide-in-from-left-2 space-y-3 border-l-2 border-emerald-100 pl-7 duration-200 dark:border-emerald-900/30">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="enable-24h"
                    checked={enable24h}
                    onChange={(e) => setEnable24h(e.target.checked)}
                    disabled={!canEditSettings}
                    className="border-border bg-background h-4 w-4 cursor-pointer rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <Label
                    htmlFor="enable-24h"
                    className="text-muted-foreground cursor-pointer text-xs font-semibold select-none"
                  >
                    Send reminder 24 Hours before {ctx.eventType.toLowerCase()}
                  </Label>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="enable-2h"
                    checked={enable2h}
                    onChange={(e) => setEnable2h(e.target.checked)}
                    disabled={!canEditSettings}
                    className="border-border bg-background h-4 w-4 cursor-pointer rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <Label
                    htmlFor="enable-2h"
                    className="text-muted-foreground cursor-pointer text-xs font-semibold select-none"
                  >
                    Send reminder 2 Hours before {ctx.eventType.toLowerCase()}
                  </Label>
                </div>

                <div className="grid max-w-xs gap-1.5 pt-2">
                  <Label
                    htmlFor="custom-offset"
                    className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase"
                  >
                    Custom Additional Offset (Minutes)
                  </Label>
                  <Input
                    id="custom-offset"
                    type="number"
                    placeholder="e.g. 60 for 1 hour before"
                    value={customTime}
                    onChange={(e) =>
                      setCustomTime(
                        e.target.value === '' ? '' : Number(e.target.value)
                      )
                    }
                    disabled={!canEditSettings}
                    className="bg-muted/40 border-border h-8 text-xs focus-visible:ring-emerald-500"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Step 2: Message Template Customize */}
        <div className="bg-card border-border space-y-4 rounded-2xl border p-6 shadow-md transition-all duration-300 hover:border-emerald-500/20 dark:hover:border-emerald-500/30">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full border border-emerald-200 bg-emerald-100 text-xs font-bold text-emerald-700 dark:border-emerald-800/30 dark:bg-emerald-950/40 dark:text-emerald-300">
              2
            </span>
            <h3 className="text-foreground flex items-center gap-1.5 text-sm font-bold">
              <FileText className="size-4 text-emerald-600 dark:text-emerald-400" />
              Reminder Template Settings
            </h3>
          </div>

          <div className="space-y-3">
            <div className="grid gap-1.5">
              <Label
                htmlFor="reminderTemplate"
                className="text-muted-foreground text-xs font-bold tracking-wider uppercase"
              >
                Message Content Template
              </Label>
              <Textarea
                id="reminderTemplate"
                placeholder="Write your custom reminder template..."
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                disabled={!canEditSettings}
                rows={9}
                className="bg-muted/40 border-border text-foreground max-w-xl resize-y text-xs leading-relaxed font-normal focus-visible:ring-emerald-500"
              />
            </div>

            <div className="max-w-xl space-y-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-[11.5px] text-emerald-950 dark:border-emerald-500/10 dark:bg-emerald-950/10 dark:text-emerald-200">
              <p className="flex items-center gap-1 font-bold text-emerald-800 dark:text-emerald-300">
                <Sparkles className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                Available Template Variables:
              </p>
              <div className="grid grid-cols-2 gap-2.5 text-[10.5px] text-emerald-900/90 dark:text-emerald-300/90">
                {ctx.templateVars.map((v) => (
                  <div key={v.code}>
                    <code className="rounded border border-emerald-200/50 bg-emerald-100/60 px-1 py-0.5 font-mono font-bold text-emerald-700 dark:border-emerald-800/30 dark:bg-emerald-900/40 dark:text-emerald-400">
                      {v.code}
                    </code>{' '}
                    - {v.desc}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Step 3: Business Hours */}
        <div className="bg-card border-border space-y-4 rounded-2xl border p-6 shadow-md transition-all duration-300 hover:border-emerald-500/20 dark:hover:border-emerald-500/30">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full border border-emerald-200 bg-emerald-100 text-xs font-bold text-emerald-700 dark:border-emerald-800/30 dark:bg-emerald-950/40 dark:text-emerald-300">
              3
            </span>
            <h3 className="text-foreground flex items-center gap-1.5 text-sm font-bold">
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
                className="border-border bg-background h-4 w-4 cursor-pointer rounded text-emerald-600 focus:ring-emerald-500"
              />
              <Label
                htmlFor="bh-enabled"
                className="text-muted-foreground cursor-pointer text-xs font-semibold select-none"
              >
                Only send WhatsApp reminders during business hours (Avoids
                disturbing {ctx.personPlural} at night)
              </Label>
            </div>

            {bhEnabled && (
              <div className="animate-in slide-in-from-left-2 grid max-w-sm grid-cols-2 gap-4 pl-7 duration-200">
                <div className="space-y-1">
                  <Label
                    htmlFor="bh-start"
                    className="text-muted-foreground text-[10px] font-bold uppercase"
                  >
                    Start Time
                  </Label>
                  <Input
                    id="bh-start"
                    type="time"
                    value={bhStart}
                    onChange={(e) => setBhStart(e.target.value)}
                    disabled={!canEditSettings}
                    className="bg-muted/40 h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label
                    htmlFor="bh-end"
                    className="text-muted-foreground text-[10px] font-bold uppercase"
                  >
                    End Time
                  </Label>
                  <Input
                    id="bh-end"
                    type="time"
                    value={bhEnd}
                    onChange={(e) => setBhEnd(e.target.value)}
                    disabled={!canEditSettings}
                    className="bg-muted/40 h-8 text-xs"
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
              className="cursor-pointer bg-emerald-700 font-bold text-white shadow-md shadow-emerald-600/10 transition-all duration-200 hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-500"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-1.5 size-4 animate-spin" />
                  Saving Configuration...
                </>
              ) : (
                'Save Reminder Config'
              )}
            </Button>
          </div>
        ) : (
          <p className="text-muted-foreground text-xs italic">
            You do not have write access to edit Reminder settings.
          </p>
        )}
      </div>
    </section>
  );
}
