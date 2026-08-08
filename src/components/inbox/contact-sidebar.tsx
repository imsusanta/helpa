'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import type { Contact, Deal, ContactNote, Tag, Conversation } from '@/types';
import {
  Phone,
  Mail,
  Copy,
  Check,
  User,
  Tag as TagIcon,
  DollarSign,
  StickyNote,
  Plus,
  Brain,
  Hospital,
  Activity,
  Calendar,
  Clock,
  FileDown,
  FileUp,
  Loader2,
  MessageSquare,
} from 'lucide-react';
import { UploadPatientPdfModal } from '@/components/contacts/upload-patient-pdf-modal';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

import { getIndustryModule } from '@/modules/registry';
import {
  getOrGeneratePatientId,
  resolveBloodGroup,
} from '@/lib/patients/id-generator';

interface ContactSidebarProps {
  contact: Contact | null;
  conversation?: Conversation | null;
  isEmbedded?: boolean;
}

export function ContactSidebar({
  contact,
  conversation,
  isEmbedded = false,
}: ContactSidebarProps) {
  const { accountId, enabledModules, account } = useAuth();

  const pipelineTitle =
    account?.industry === 'hospital_clinic'
      ? 'Patient Care Cycle'
      : account?.industry === 'coaching' || account?.industry === 'solo_teacher'
        ? 'Enrollment Pipeline'
        : account?.industry === 'real_estate'
          ? 'Deals / Pipeline'
          : account?.industry === 'travel'
            ? 'Trip Bookings'
            : account?.industry === 'gym'
              ? 'Membership Stages'
              : account?.industry === 'restaurant'
                ? 'Reservation Pipeline'
                : 'Deals / Pipeline';

  const [copied, setCopied] = useState(false);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [notes, setNotes] = useState<ContactNote[]>([]);
  const [tags, setTags] = useState<(Tag & { contact_tag_id: string })[]>([]);
  const [newNote, setNewNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);

  // Hospital & Clinic booking states
  const [patient, setPatient] = useState<any | null>(null);
  const [showBookForm, setShowBookForm] = useState(false);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [uploadPdfOpen, setUploadPdfOpen] = useState(false);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loadingForm, setLoadingForm] = useState(false);
  const [upcomingAppointment, setUpcomingAppointment] = useState<any | null>(
    null
  );
  const [recentReports, setRecentReports] = useState<any[]>([]);
  const [notifyingReportId, setNotifyingReportId] = useState<string | null>(
    null
  );

  const [bookingDocId, setBookingDocId] = useState('');
  const [bookingDate, setBookingDate] = useState('');
  const [bookingTime, setBookingTime] = useState('');
  const [bookingNotes, setBookingNotes] = useState('');

  const fetchContactData = useCallback(async () => {
    if (!contact) return;

    const supabase = createClient();
    const isHospital = account?.industry === 'hospital_clinic';

    try {
      // 1. Fetch core CRM fields (deals, notes, tags)
      const [dealsRes, notesRes, tagsRes] = await Promise.all([
        supabase
          .from('deals')
          .select('*, stage:pipeline_stages(*)')
          .eq('contact_id', contact.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('contact_notes')
          .select('*')
          .eq('contact_id', contact.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('contact_tags')
          .select('id, tag_id, tags(*)')
          .eq('contact_id', contact.id),
      ]);

      if (dealsRes.data) setDeals(dealsRes.data);
      if (notesRes.data) setNotes(notesRes.data);
      if (tagsRes.data) {
        const mapped = tagsRes.data
          .filter((ct: Record<string, unknown>) => ct.tags)
          .map((ct: Record<string, unknown>) => ({
            ...(ct.tags as Tag),
            contact_tag_id: ct.id as string,
          }));
        setTags(mapped);
      }

      // 2. Fetch hospital-specific info if active workspace is Hospital & Clinic
      if (isHospital) {
        const [patientRes, apptRes, reportRes] = await Promise.all([
          supabase
            .from('patients')
            .select('*')
            .eq('id', contact.id)
            .maybeSingle(),
          supabase
            .from('appointments')
            .select('*, doctor:hospital_doctors(name)')
            .eq('patient_id', contact.id)
            .gte('appointment_date', new Date().toISOString().split('T')[0])
            .order('appointment_date', { ascending: true })
            .order('appointment_time', { ascending: true })
            .limit(1)
            .maybeSingle(),
          supabase
            .from('hospital_lab_reports')
            .select('*')
            .eq('patient_id', contact.id)
            .order('created_at', { ascending: false })
            .limit(5),
        ]);

        if (patientRes.data) setPatient(patientRes.data);
        else setPatient(null);

        if (apptRes.data) setUpcomingAppointment(apptRes.data);
        else setUpcomingAppointment(null);

        setRecentReports(
          Array.isArray(reportRes.data)
            ? reportRes.data
            : reportRes.data
              ? [reportRes.data]
              : []
        );
      } else {
        setPatient(null);
        setUpcomingAppointment(null);
        setRecentReports([]);
      }
    } catch (err) {
      console.error('[ContactSidebar] Error fetching contact details:', err);
    }
  }, [contact, enabledModules, account?.industry]);

  // Lazy-load doctors & branches for hospital booking widget
  useEffect(() => {
    if ((showBookForm || showInviteForm) && doctors.length === 0) {
      const supabase = createClient();
      async function loadDocs() {
        const [dRes, bRes] = await Promise.all([
          supabase
            .from('hospital_doctors')
            .select('*')
            .eq('account_id', accountId)
            .eq('status', 'active'),
          supabase
            .from('hospital_branches')
            .select('*')
            .eq('account_id', accountId),
        ]);
        setDoctors(dRes.data || []);
        setBranches(bRes.data || []);
      }
      loadDocs();
    }
  }, [showBookForm, showInviteForm, accountId, doctors.length]);

  const handleSidebarBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contact || !bookingDate || !bookingTime) return;
    setLoadingForm(true);
    const supabase = createClient();
    try {
      // 1. Ensure patient record exists
      let pat = patient;
      if (!pat) {
        const { data: newPat, error: pErr } = await supabase
          .from('patients')
          .insert({
            id: contact.id,
            account_id: accountId,
            status: 'active',
          })
          .select()
          .single();
        if (pErr) throw pErr;
        pat = newPat;
        setPatient(newPat);
      }

      // 2. Resolve department
      const doc = doctors.find((d) => d.id === bookingDocId);
      const dept = doc ? doc.department : 'General Medicine';

      // 3. Book appointment
      const { data: appt, error: apptErr } = await supabase
        .from('appointments')
        .insert({
          account_id: accountId,
          patient_id: contact.id,
          doctor_id: bookingDocId || null,
          department: dept,
          appointment_date: bookingDate,
          appointment_time: bookingTime,
          status: 'pending',
          notes: bookingNotes,
        })
        .select()
        .single();

      if (apptErr) throw apptErr;

      // 4. Send auto-WhatsApp confirmation alert!
      fetch('/api/whatsapp/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'appointment_confirmation',
          appointmentId: appt.id,
        }),
      }).catch((err) => console.error('Auto WhatsApp confirmation fail', err));

      toast.success('Appointment booked & patient notified via WhatsApp!');
      setShowBookForm(false);
      setBookingDocId('');
      setBookingDate('');
      setBookingTime('');
      setBookingNotes('');

      // Reload list
      fetchContactData();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to book appointment');
    } finally {
      setLoadingForm(false);
    }
  };

  const handleSidebarInvite = async (docId: string) => {
    if (!contact) return;
    try {
      toast.info('Sending booking invitation on WhatsApp...');
      const res = await fetch('/api/whatsapp/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'booking_invite',
          doctorId: docId,
          patientId: contact.id,
        }),
      });
      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
      } else {
        toast.success('Booking invitation dispatched on WhatsApp!');
        setShowInviteForm(false);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to send invitation');
    }
  };

  const handleSendToWhatsApp = async (reportId: string) => {
    if (!accountId) return;
    setNotifyingReportId(reportId);
    try {
      const res = await fetch('/api/lab-reports/notify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reportId, accountId }),
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      toast.success('Report successfully sent via WhatsApp!');
      fetchContactData();
    } catch (err: any) {
      console.error('Failed to notify patient via WhatsApp:', err);
      toast.error('Failed to send WhatsApp message: ' + err.message);
    } finally {
      setNotifyingReportId(null);
    }
  };

  // Load on contact change. setContactData/setTags run inside async
  // Supabase callbacks, not synchronously in the effect body.
  useEffect(() => {
     
    fetchContactData();
  }, [fetchContactData]);

  const handleCopyPhone = useCallback(async () => {
    if (!contact?.phone) return;
    await navigator.clipboard.writeText(contact.phone);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    // Dep is the whole `contact` object (not `contact?.phone`) so the
    // React Compiler's inference agrees with the manual dep list —
    // fixes the `preserve-manual-memoization` lint error.
  }, [contact]);

  const handleAddNote = useCallback(async () => {
    if (!contact || !newNote.trim()) return;
    if (!accountId) return;
    setAddingNote(true);

    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;

    const { data, error } = await supabase
      .from('contact_notes')
      .insert({
        contact_id: contact.id,
        account_id: accountId,
        user_id: user?.id,
        note_text: newNote.trim(),
      })
      .select()
      .single();

    if (!error && data) {
      setNotes((prev) => [data, ...prev]);
      setNewNote('');
    }
    setAddingNote(false);
  }, [contact, newNote, accountId]);

  if (!contact) {
    return (
      <div className="bg-card flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground text-sm">Select a conversation</p>
      </div>
    );
  }

  const displayName = contact.name || contact.phone;
  const initials = displayName.charAt(0).toUpperCase();

  const content = (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="p-4 pb-20">
        {/* Profile Card */}
        <div className="bg-muted/30 border-border/50 mb-4 flex flex-col items-center space-y-3 rounded-xl border p-4 text-center shadow-sm">
          <div className="relative">
            <div className="bg-background border-primary/20 text-foreground flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-2 text-lg font-semibold">
              {contact.avatar_url ? (
                <img
                  src={contact.avatar_url}
                  alt={displayName}
                  className="h-16 w-16 rounded-full object-cover"
                />
              ) : (
                initials
              )}
            </div>
            <span
              className="border-background absolute right-0 bottom-0 h-3 w-3 rounded-full border-2 bg-emerald-500"
              title="Active"
            />
          </div>

          <div className="space-y-0.5">
            <h3 className="text-foreground max-w-[200px] truncate text-sm font-bold">
              {displayName}
            </h3>
            {contact.company && (
              <p className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
                {contact.company}
              </p>
            )}
          </div>

          {/* Quick Actions / Contact Info */}
          <div className="border-border/40 w-full space-y-1.5 border-t pt-3">
            <button
              onClick={handleCopyPhone}
              className="text-muted-foreground hover:bg-muted hover:text-foreground flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs transition-colors"
            >
              <Phone className="h-3.5 w-3.5 shrink-0" />
              <span className="flex-1 truncate text-left font-medium">
                {contact.phone}
              </span>
              {copied ? (
                <Check className="h-3 w-3 text-emerald-500" />
              ) : (
                <Copy className="text-muted-foreground h-3 w-3" />
              )}
            </button>

            {contact.email && (
              <div className="text-muted-foreground flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium select-text">
                <Mail className="h-3.5 w-3.5 shrink-0" />
                <span className="flex-1 truncate text-left">
                  {contact.email}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* AI Insights */}
        {conversation &&
          (conversation.ai_intent ||
            conversation.ai_lead_score ||
            conversation.ai_summary) && (
            <>
              <div className="border-border my-4 border-t" />
              <div className="text-card-foreground rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wider text-emerald-600 uppercase dark:text-emerald-400">
                  <Brain className="h-3.5 w-3.5 text-emerald-500" />
                  AI Insights
                </div>

                <div className="mt-3 space-y-2.5">
                  {/* Lead Score, Intent, Sentiment */}
                  <div className="flex flex-wrap gap-1.5">
                    {conversation.ai_lead_score && (
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-semibold',
                          conversation.ai_lead_score === 'hot'
                            ? 'animate-pulse border-red-500/20 bg-red-500/10 text-red-300'
                            : conversation.ai_lead_score === 'warm'
                              ? 'border-amber-500/20 bg-amber-500/10 text-amber-300'
                              : 'border-blue-500/20 bg-blue-500/10 text-blue-300'
                        )}
                      >
                        {conversation.ai_lead_score.toUpperCase()}
                      </span>
                    )}

                    {conversation.ai_intent && (
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-semibold',
                          conversation.ai_intent === 'sales'
                            ? 'border-green-500/20 bg-green-500/10 text-green-300'
                            : conversation.ai_intent === 'support'
                              ? 'border-sky-500/20 bg-sky-500/10 text-sky-300'
                              : conversation.ai_intent === 'booking'
                                ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                : conversation.ai_intent === 'complaint'
                                  ? 'border-rose-500/20 bg-rose-500/10 text-rose-300'
                                  : 'border-gray-500/20 bg-gray-500/10 text-gray-300'
                        )}
                      >
                        {conversation.ai_intent.toUpperCase()}
                      </span>
                    )}

                    {conversation.ai_sentiment && (
                      <span className="bg-muted/40 text-muted-foreground border-border inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-semibold">
                        {conversation.ai_sentiment === 'positive'
                          ? '😊 POSITIVE'
                          : conversation.ai_sentiment === 'negative'
                            ? '😠 NEGATIVE'
                            : '😐 NEUTRAL'}
                      </span>
                    )}
                  </div>

                  {/* FAQ Category */}
                  {conversation.ai_faq_category &&
                    conversation.ai_faq_category !== 'general' && (
                      <div className="text-muted-foreground flex items-center gap-1 text-[10px]">
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                          Topic:
                        </span>
                        <span className="capitalize">
                          {conversation.ai_faq_category}
                        </span>
                      </div>
                    )}

                  {/* Handoff Status */}
                  {conversation.ai_handoff_required && (
                    <div className="flex animate-pulse items-center gap-1.5 rounded-lg border border-red-500/20 bg-red-950/30 p-2 text-[10px] font-semibold text-red-200">
                      <span>⚠️</span> Human Handoff Requested
                    </div>
                  )}

                  {/* Summary */}
                  {conversation.ai_summary && (
                    <div className="space-y-1">
                      <span className="text-muted-foreground block text-[9px] font-semibold tracking-wider uppercase">
                        Conversation Summary
                      </span>
                      <p className="text-foreground bg-muted/45 rounded-lg p-2 text-xs leading-relaxed whitespace-pre-wrap">
                        {conversation.ai_summary}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

        {/* Hospital & Clinic Operations Module Widget */}
        {account?.industry === 'hospital_clinic' && (
          <>
            <div className="border-border my-4 border-t" />
            <div className="border-primary/20 bg-muted/20 space-y-3 rounded-xl border p-3">
              <div className="text-primary flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
                <Hospital className="h-3.5 w-3.5" />
                Clinical Actions
              </div>

              <div className="space-y-2.5">
                <div className="text-muted-foreground bg-background/50 border-border/40 grid grid-cols-2 gap-2 rounded-lg border p-2 text-[10px]">
                  <div>
                    <span className="text-muted-foreground block text-[8px] font-bold uppercase">
                      Patient ID
                    </span>
                    <span className="text-foreground font-mono text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                      {getOrGeneratePatientId(contact, patient?.patient_seq_id)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[8px] font-bold uppercase">
                      Blood Group
                    </span>
                    {(() => {
                      const { bg, source } = resolveBloodGroup(
                        patient?.blood_group,
                        typeof contact?.metadata?.blood_group === 'string'
                          ? contact.metadata.blood_group
                          : null,
                        recentReports
                      );
                      if (!bg)
                        return (
                          <span className="text-muted-foreground text-[10px] italic">
                            Not specified
                          </span>
                        );
                      return (
                        <div className="flex items-center gap-1">
                          <span className="text-foreground text-[11px] font-bold text-rose-600 dark:text-rose-400">
                            {bg}
                          </span>
                          {source === 'report' && (
                            <span
                              className="py-0.2 rounded bg-sky-500/10 px-1 text-[8px] font-semibold text-sky-600 dark:text-sky-400"
                              title="Extracted automatically from Patient Lab Report"
                            >
                              Lab
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Upcoming Appointment Info */}
                {upcomingAppointment ? (
                  <div className="bg-primary/5 border-primary/10 space-y-1 rounded-lg border p-2 text-[10px]">
                    <span className="text-primary block text-[8px] font-bold uppercase">
                      Upcoming Appointment
                    </span>
                    <p className="text-foreground font-semibold">
                      {upcomingAppointment.doctor?.name || 'General Consult'} (
                      {upcomingAppointment.department})
                    </p>
                    <p className="text-muted-foreground">
                      {format(
                        new Date(upcomingAppointment.appointment_date),
                        'MMM d, yyyy'
                      )}{' '}
                      at {upcomingAppointment.appointment_time}
                    </p>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="bg-primary/10 text-primary rounded px-1.5 py-0.5 text-[9px] font-bold uppercase">
                        {upcomingAppointment.status}
                      </span>
                      <span className="text-foreground text-[9px] font-semibold">
                        Token: #{upcomingAppointment.token_number}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="bg-muted/40 border-border/30 text-muted-foreground rounded-lg border p-2 text-center text-[10px]">
                    No upcoming appointments scheduled.
                  </div>
                )}

                {/* Lab Reports List */}
                {recentReports.length > 0 ? (
                  <div className="w-full space-y-1.5">
                    <span className="block text-[8px] font-bold text-emerald-600 uppercase dark:text-emerald-400">
                      Lab Reports ({recentReports.length})
                    </span>
                    <div className="space-y-1">
                      {recentReports.map((rep: any) => (
                        <div
                          key={rep.id}
                          className="bg-muted/40 border-border/30 flex items-center justify-between gap-2 rounded-lg border p-2 text-[10px]"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-foreground truncate font-semibold">
                              {rep.test_name}
                            </p>
                            <div className="mt-0.5 flex items-center gap-1.5 text-[8.5px]">
                              <span
                                className={cn(
                                  'rounded-[3px] px-1 font-bold uppercase',
                                  rep.status === 'ready'
                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                    : rep.status === 'processing'
                                      ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400'
                                      : rep.status === 'delivered'
                                        ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                                        : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                )}
                              >
                                {rep.status}
                              </span>
                              <span className="text-muted-foreground">
                                {new Date(rep.created_at).toLocaleDateString(
                                  undefined,
                                  { month: 'short', day: 'numeric' }
                                )}
                              </span>
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5">
                            {rep.report_pdf_url && (
                              <a
                                href={rep.report_pdf_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="cursor-pointer text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
                                title="Download Report PDF"
                              >
                                <FileDown className="h-3.5 w-3.5" />
                              </a>
                            )}
                            <button
                              onClick={() => handleSendToWhatsApp(rep.id)}
                              disabled={notifyingReportId === rep.id}
                              className="cursor-pointer text-emerald-600 hover:text-emerald-700 disabled:opacity-50 dark:text-emerald-400 dark:hover:text-emerald-300"
                              title={
                                rep.notified_patient
                                  ? 'Resend Report via WhatsApp'
                                  : 'Send Report via WhatsApp'
                              }
                            >
                              {notifyingReportId === rep.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <MessageSquare className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="bg-muted/40 border-border/30 text-muted-foreground rounded-lg border p-2 text-center text-[10px]">
                    No lab reports generated yet.
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 h-8 w-full cursor-pointer justify-center gap-1.5 text-xs font-semibold"
                  onClick={() => {
                    setShowBookForm(!showBookForm);
                    setShowInviteForm(false);
                  }}
                >
                  <Calendar className="h-3.5 w-3.5" />
                  Book Appointment
                </Button>
                <div className="grid grid-cols-2 gap-1.5">
                  <Button
                    size="xs"
                    variant="outline"
                    className="h-7 cursor-pointer justify-center gap-1.5 border-emerald-500/40 bg-emerald-500/10 text-[11px] font-semibold text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400"
                    onClick={() => setUploadPdfOpen(true)}
                  >
                    <FileUp className="h-3.5 w-3.5" />
                    Upload PDF
                  </Button>
                  <Button
                    size="xs"
                    variant="outline"
                    className="text-muted-foreground hover:text-foreground h-7 cursor-pointer justify-center gap-1.5 text-[11px]"
                    onClick={() => {
                      setShowInviteForm(!showInviteForm);
                      setShowBookForm(false);
                    }}
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    Send Invite
                  </Button>
                </div>
              </div>

              {/* Inline Book Appointment Form */}
              {showBookForm && (
                <form
                  onSubmit={handleSidebarBook}
                  className="border-border/50 animate-in fade-in space-y-2 border-t pt-2 duration-200"
                >
                  <div className="space-y-0.5">
                    <Label htmlFor="side-doc" className="text-[10px]">
                      Select Doctor
                    </Label>
                    <select
                      id="side-doc"
                      className="border-input bg-background h-7 w-full rounded-md border px-1.5 text-xs"
                      required
                      value={bookingDocId}
                      onChange={(e) => setBookingDocId(e.target.value)}
                    >
                      <option value="">-- Choose Doctor --</option>
                      {doctors.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} ({d.department})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <div className="space-y-0.5">
                      <Label htmlFor="side-date" className="text-[10px]">
                        Date
                      </Label>
                      <Input
                        id="side-date"
                        type="date"
                        required
                        value={bookingDate}
                        onChange={(e) => setBookingDate(e.target.value)}
                        className="h-7 px-1.5 text-xs"
                      />
                    </div>
                    <div className="space-y-0.5">
                      <Label htmlFor="side-time" className="text-[10px]">
                        Time
                      </Label>
                      <Input
                        id="side-time"
                        type="time"
                        required
                        value={bookingTime}
                        onChange={(e) => setBookingTime(e.target.value)}
                        className="h-7 px-1.5 text-xs"
                      />
                    </div>
                  </div>
                  <div className="space-y-0.5">
                    <Label htmlFor="side-notes" className="text-[10px]">
                      Consultation Notes
                    </Label>
                    <Input
                      id="side-notes"
                      value={bookingNotes}
                      onChange={(e) => setBookingNotes(e.target.value)}
                      placeholder="Reason for booking..."
                      className="h-7 px-1.5 text-xs"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={loadingForm}
                    className="mt-2 flex h-8 w-full cursor-pointer items-center justify-center gap-1.5 rounded-md border-0 bg-emerald-600 text-[11px] font-semibold text-white shadow-sm transition-all duration-150 hover:bg-emerald-700"
                  >
                    {loadingForm ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Booking...
                      </>
                    ) : (
                      <>
                        <Calendar className="h-3.5 w-3.5" />
                        Confirm & Notify WA
                      </>
                    )}
                  </Button>
                </form>
              )}

              {/* Inline Invite Campaign Form */}
              {showInviteForm && (
                <div className="border-border/50 animate-in fade-in space-y-2 border-t pt-2 duration-200">
                  <p className="text-muted-foreground text-[10px]">
                    Select a doctor to send a WhatsApp booking invitation
                    directly to this customer:
                  </p>
                  <div className="max-h-32 space-y-1.5 overflow-y-auto pr-1">
                    {doctors.length === 0 ? (
                      <p className="text-muted-foreground py-2 text-center text-[10px]">
                        No active doctors available
                      </p>
                    ) : (
                      doctors.map((d) => (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => handleSidebarInvite(d.id)}
                          className="bg-background border-border hover:border-primary hover:text-primary flex w-full items-center justify-between rounded border p-1.5 text-left text-[11px] transition-colors"
                        >
                          <span>
                            {d.name} ({d.department})
                          </span>
                          <span className="bg-primary/10 rounded px-1 text-[9px] font-bold uppercase">
                            Send
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Divider */}
        <div className="border-border my-4 border-t" />

        {/* Tags */}
        <div>
          <div className="text-muted-foreground flex items-center gap-2 px-1 text-xs font-medium tracking-wider uppercase">
            <TagIcon className="h-3 w-3" />
            Tags
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {tags.length === 0 ? (
              <p className="text-muted-foreground px-1 text-xs">No tags</p>
            ) : (
              tags.map((tag) => (
                <span
                  key={tag.contact_tag_id}
                  className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                  style={{
                    backgroundColor: `${tag.color}20`,
                    color: tag.color,
                  }}
                >
                  {tag.name}
                </span>
              ))
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="border-border my-4 border-t" />

        {/* Active Care Pipeline */}
        <div>
          <div className="text-muted-foreground flex items-center gap-2 px-1 text-xs font-medium tracking-wider uppercase">
            <Activity className="h-3 w-3" />
            {pipelineTitle}
          </div>
          <div className="mt-2 space-y-2">
            {deals.length === 0 ? (
              <p className="text-muted-foreground px-1 text-xs">
                No active items
              </p>
            ) : (
              deals.map((deal) => (
                <div key={deal.id} className="bg-muted rounded-lg px-3 py-2">
                  <p className="text-foreground text-sm font-medium">
                    {deal.title}
                  </p>
                  <div className="text-muted-foreground mt-1 flex items-center justify-between text-xs">
                    <span>
                      {deal.currency ?? '$'}
                      {deal.value.toLocaleString()}
                    </span>
                    {deal.stage && (
                      <span
                        className="rounded-full px-1.5 py-0.5 text-[10px]"
                        style={{
                          backgroundColor: `${deal.stage.color}20`,
                          color: deal.stage.color,
                        }}
                      >
                        {deal.stage.name}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="border-border my-4 border-t" />

        {/* Notes */}
        <div>
          <div className="text-muted-foreground flex items-center gap-2 px-1 text-xs font-medium tracking-wider uppercase">
            <StickyNote className="h-3 w-3" />
            Notes
          </div>
          <div className="mt-2">
            <div className="flex gap-2">
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Add a note..."
                rows={2}
                className="border-border bg-muted text-foreground placeholder-muted-foreground focus:border-primary/50 flex-1 resize-none rounded-lg border px-3 py-2 text-xs outline-none"
              />
              <Button
                size="sm"
                className="bg-primary hover:bg-primary/90 h-auto px-2"
                onClick={handleAddNote}
                disabled={!newNote.trim() || addingNote}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>

            <div className="mt-2 space-y-2">
              {notes.map((note) => (
                <div key={note.id} className="bg-muted rounded-lg px-3 py-2">
                  <p className="text-muted-foreground text-xs whitespace-pre-wrap">
                    {note.note_text}
                  </p>
                  <p className="text-muted-foreground mt-1 text-[10px]">
                    {format(new Date(note.created_at), 'MMM d, yyyy HH:mm')}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (isEmbedded) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {content}
      </div>
    );
  }

  return (
    <div className="border-border bg-card flex h-full min-h-0 w-70 flex-col overflow-hidden border-l">
      {content}

      {contact && (
        <UploadPatientPdfModal
          open={uploadPdfOpen}
          onOpenChange={setUploadPdfOpen}
          patientId={getOrGeneratePatientId(contact, patient?.patient_seq_id)}
          contactId={contact.id}
          patientName={contact.name || 'Patient'}
          patientPhone={contact.phone}
          onSuccess={() => {}}
        />
      )}
    </div>
  );
}
