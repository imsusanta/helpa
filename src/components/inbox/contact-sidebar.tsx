"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import type { Contact, Deal, ContactNote, Tag, Conversation } from "@/types";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface ContactSidebarProps {
  contact: Contact | null;
  conversation?: Conversation | null;
  isEmbedded?: boolean;
}

export function ContactSidebar({ contact, conversation, isEmbedded }: ContactSidebarProps) {
  const { accountId, enabledModules } = useAuth();
  const [copied, setCopied] = useState(false);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [notes, setNotes] = useState<ContactNote[]>([]);
  const [tags, setTags] = useState<(Tag & { contact_tag_id: string })[]>([]);
  const [newNote, setNewNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);

  // Hospital & Clinic booking states
  const [patient, setPatient] = useState<any | null>(null);
  const [showBookForm, setShowBookForm] = useState(false);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loadingForm, setLoadingForm] = useState(false);
  const [upcomingAppointment, setUpcomingAppointment] = useState<any | null>(null);
  const [latestReport, setLatestReport] = useState<any | null>(null);

  const [bookingDocId, setBookingDocId] = useState("");
  const [bookingDate, setBookingDate] = useState("");
  const [bookingTime, setBookingTime] = useState("");
  const [bookingNotes, setBookingNotes] = useState("");

  const fetchContactData = useCallback(async () => {
    if (!contact) return;

    const supabase = createClient();

    // Fetch deals, notes, tags, and patient in parallel
    const [dealsRes, notesRes, tagsRes, patientRes, apptRes, reportRes] = await Promise.all([
      supabase
        .from("deals")
        .select("*, stage:pipeline_stages(*)")
        .eq("contact_id", contact.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("contact_notes")
        .select("*")
        .eq("contact_id", contact.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("contact_tags")
        .select("id, tag_id, tags(*)")
        .eq("contact_id", contact.id),
      supabase
        .from("patients")
        .select("*")
        .eq("id", contact.id)
        .maybeSingle(),
      supabase
        .from("appointments")
        .select("*, doctor:hospital_doctors(name)")
        .eq("patient_id", contact.id)
        .gte("appointment_date", new Date().toISOString().split("T")[0])
        .order("appointment_date", { ascending: true })
        .order("appointment_time", { ascending: true })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("hospital_lab_reports")
        .select("*")
        .eq("patient_id", contact.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (dealsRes.data) setDeals(dealsRes.data);
    if (notesRes.data) setNotes(notesRes.data);
    if (patientRes.data) setPatient(patientRes.data);
    if (apptRes.data) setUpcomingAppointment(apptRes.data);
    else setUpcomingAppointment(null);
    if (reportRes.data) setLatestReport(reportRes.data);
    else setLatestReport(null);
    if (tagsRes.data) {
      const mapped = tagsRes.data
        .filter((ct: Record<string, unknown>) => ct.tags)
        .map((ct: Record<string, unknown>) => ({
          ...(ct.tags as Tag),
          contact_tag_id: ct.id as string,
        }));
      setTags(mapped);
    }
  }, [contact, enabledModules]);

  // Lazy-load doctors & branches for hospital booking widget
  useEffect(() => {
    if ((showBookForm || showInviteForm) && doctors.length === 0) {
      const supabase = createClient();
      async function loadDocs() {
        const [dRes, bRes] = await Promise.all([
          supabase.from("hospital_doctors").select("*").eq("account_id", accountId).eq("status", "active"),
          supabase.from("hospital_branches").select("*").eq("account_id", accountId),
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
        const seq = `PAT-${Date.now().toString().slice(-5)}`;
        const { data: newPat, error: pErr } = await supabase
          .from("patients")
          .insert({
            id: contact.id,
            account_id: accountId,
            patient_seq_id: seq,
            status: "active",
          })
          .select()
          .single();
        if (pErr) throw pErr;
        pat = newPat;
        setPatient(newPat);
      }

      // 2. Resolve department
      const doc = doctors.find((d) => d.id === bookingDocId);
      const dept = doc ? doc.department : "General Medicine";

      // 3. Book appointment
      const { data: appt, error: apptErr } = await supabase
        .from("appointments")
        .insert({
          account_id: accountId,
          patient_id: contact.id,
          doctor_id: bookingDocId || null,
          department: dept,
          appointment_date: bookingDate,
          appointment_time: bookingTime,
          status: "pending",
          notes: bookingNotes,
        })
        .select()
        .single();

      if (apptErr) throw apptErr;

      // 4. Send auto-WhatsApp confirmation alert!
      fetch("/api/whatsapp/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "appointment_confirmation",
          appointmentId: appt.id,
        }),
      }).catch((err) => console.error("Auto WhatsApp confirmation fail", err));

      toast.success("Appointment booked & patient notified via WhatsApp!");
      setShowBookForm(false);
      setBookingDocId("");
      setBookingDate("");
      setBookingTime("");
      setBookingNotes("");
      
      // Reload list
      fetchContactData();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to book appointment");
    } finally {
      setLoadingForm(false);
    }
  };

  const handleSidebarInvite = async (docId: string) => {
    if (!contact) return;
    try {
      toast.info("Sending booking invitation on WhatsApp...");
      const res = await fetch("/api/whatsapp/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "booking_invite",
          doctorId: docId,
          patientId: contact.id,
        }),
      });
      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
      } else {
        toast.success("Booking invitation dispatched on WhatsApp!");
        setShowInviteForm(false);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to send invitation");
    }
  };

  // Load on contact change. setContactData/setTags run inside async
  // Supabase callbacks, not synchronously in the effect body.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
      .from("contact_notes")
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
      setNewNote("");
    }
    setAddingNote(false);
  }, [contact, newNote, accountId]);

  if (!contact) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-card">
        <p className="text-sm text-muted-foreground">Select a conversation</p>
      </div>
    );
  }

  const displayName = contact.name || contact.phone;
  const initials = displayName.charAt(0).toUpperCase();

  const content = (
    <ScrollArea className="flex-1">
        <div className="p-4">
          {/* Contact Info */}
          <div className="flex flex-col items-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-lg font-semibold text-foreground">
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
            <h3 className="mt-3 text-sm font-semibold text-foreground">
              {displayName}
            </h3>
            {contact.company && (
              <p className="text-xs text-muted-foreground">{contact.company}</p>
            )}
          </div>

          {/* Phone */}
          <div className="mt-4 space-y-2">
            <button
              onClick={handleCopyPhone}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted"
            >
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1 text-left">{contact.phone}</span>
              {copied ? (
                <Check className="h-3 w-3 text-primary" />
              ) : (
                <Copy className="h-3 w-3 text-muted-foreground" />
              )}
            </button>

            {contact.email && (
              <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="truncate">{contact.email}</span>
              </div>
            )}
          </div>

          {/* AI Insights */}
          {conversation && (conversation.ai_intent || conversation.ai_lead_score || conversation.ai_summary) && (
            <>
              <div className="my-4 border-t border-border" />
              <div className="rounded-xl border border-purple-500/20 bg-purple-950/10 p-3 text-card-foreground">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-purple-300">
                  <Brain className="h-3.5 w-3.5 text-purple-400" />
                  AI Insights
                </div>

                <div className="mt-3 space-y-2.5">
                  {/* Lead Score, Intent, Sentiment */}
                  <div className="flex flex-wrap gap-1.5">
                    {conversation.ai_lead_score && (
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-semibold border",
                          conversation.ai_lead_score === "hot"
                            ? "bg-red-500/10 text-red-300 border-red-500/20 animate-pulse"
                            : conversation.ai_lead_score === "warm"
                            ? "bg-amber-500/10 text-amber-300 border-amber-500/20"
                            : "bg-blue-500/10 text-blue-300 border-blue-500/20"
                        )}
                      >
                        {conversation.ai_lead_score.toUpperCase()}
                      </span>
                    )}

                    {conversation.ai_intent && (
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-semibold border",
                          conversation.ai_intent === "sales"
                            ? "bg-green-500/10 text-green-300 border-green-500/20"
                            : conversation.ai_intent === "support"
                            ? "bg-sky-500/10 text-sky-300 border-sky-500/20"
                            : conversation.ai_intent === "booking"
                            ? "bg-purple-500/10 text-purple-300 border-purple-500/20"
                            : conversation.ai_intent === "complaint"
                            ? "bg-rose-500/10 text-rose-300 border-rose-500/20"
                            : "bg-gray-500/10 text-gray-300 border-gray-500/20"
                        )}
                      >
                        {conversation.ai_intent.toUpperCase()}
                      </span>
                    )}

                    {conversation.ai_sentiment && (
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-semibold border bg-muted/40 text-muted-foreground border-border">
                        {conversation.ai_sentiment === "positive"
                          ? "😊 POSITIVE"
                          : conversation.ai_sentiment === "negative"
                          ? "😠 NEGATIVE"
                          : "😐 NEUTRAL"}
                      </span>
                    )}
                  </div>

                  {/* FAQ Category */}
                  {conversation.ai_faq_category && conversation.ai_faq_category !== "general" && (
                    <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <span className="font-semibold text-purple-300">Topic:</span>
                      <span className="capitalize">{conversation.ai_faq_category}</span>
                    </div>
                  )}

                  {/* Handoff Status */}
                  {conversation.ai_handoff_required && (
                    <div className="rounded-lg border border-red-500/20 bg-red-950/30 p-2 text-[10px] text-red-200 font-semibold flex items-center gap-1.5 animate-pulse">
                      <span>⚠️</span> Human Handoff Requested
                    </div>
                  )}

                  {/* Summary */}
                  {conversation.ai_summary && (
                    <div className="space-y-1">
                      <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground block">
                        Conversation Summary
                      </span>
                      <p className="text-xs text-foreground bg-muted/45 p-2 rounded-lg leading-relaxed whitespace-pre-wrap">
                        {conversation.ai_summary}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Hospital & Clinic Operations Module Widget */}
          {enabledModules.includes("hospital_clinic") && (
            <>
              <div className="my-4 border-t border-border" />
              <div className="rounded-xl border border-primary/20 bg-muted/20 p-3 space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
                  <Hospital className="h-3.5 w-3.5" />
                  Clinical Actions
                </div>

                {patient ? (
                  <div className="space-y-2.5">
                    <div className="grid grid-cols-2 gap-2 text-[10px] text-muted-foreground bg-background/50 p-2 rounded-lg border border-border/40">
                      <div>
                        <span className="block text-[8px] uppercase font-bold">Patient ID</span>
                        <span className="text-foreground font-semibold">{patient.patient_seq_id}</span>
                      </div>
                      {patient.blood_group && (
                        <div>
                          <span className="block text-[8px] uppercase font-bold">Blood Group</span>
                          <span className="text-foreground font-semibold">{patient.blood_group}</span>
                        </div>
                      )}
                    </div>

                    {/* Upcoming Appointment Info */}
                    {upcomingAppointment ? (
                      <div className="bg-primary/5 border border-primary/10 rounded-lg p-2 text-[10px] space-y-1">
                        <span className="block text-[8px] uppercase font-bold text-primary">Upcoming Appointment</span>
                        <p className="font-semibold text-foreground">
                          {upcomingAppointment.doctor?.name || "General Consult"} ({upcomingAppointment.department})
                        </p>
                        <p className="text-muted-foreground">
                          {format(new Date(upcomingAppointment.appointment_date), "MMM d, yyyy")} at {upcomingAppointment.appointment_time}
                        </p>
                        <div className="flex justify-between items-center mt-1">
                          <span className="text-[9px] font-bold uppercase bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                            {upcomingAppointment.status}
                          </span>
                          <span className="font-semibold text-foreground text-[9px]">
                            Token: #{upcomingAppointment.token_number}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-muted/40 border border-border/30 rounded-lg p-2 text-[10px] text-muted-foreground text-center">
                        No upcoming appointments scheduled.
                      </div>
                    )}

                    {/* Latest Lab Report Info */}
                    {latestReport ? (
                      <div className="bg-purple-500/5 border border-purple-500/10 rounded-lg p-2 text-[10px] space-y-1">
                        <span className="block text-[8px] uppercase font-bold text-purple-400">Latest Lab Report</span>
                        <p className="font-semibold text-foreground">{latestReport.test_name}</p>
                        <div className="flex justify-between items-center mt-1">
                          <span className={cn(
                            "text-[9px] font-bold uppercase px-1.5 py-0.5 rounded",
                            latestReport.status === 'ready'
                              ? "bg-emerald-500/10 text-emerald-500"
                              : latestReport.status === 'processing'
                              ? "bg-sky-500/10 text-sky-500"
                              : "bg-amber-500/10 text-amber-500"
                          )}>
                            {latestReport.status}
                          </span>
                          {latestReport.report_pdf_url && (
                            <a
                              href={latestReport.report_pdf_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary hover:underline font-semibold text-[9px]"
                            >
                              Download PDF
                            </a>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-muted/40 border border-border/30 rounded-lg p-2 text-[10px] text-muted-foreground text-center">
                        No lab reports generated yet.
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground leading-normal">
                    This contact is not registered as a clinical patient yet. Booking will auto-create their file.
                  </p>
                )}

                <div className="flex gap-2">
                  <Button size="xs" variant="outline" className="flex-1 text-[10px]" onClick={() => { setShowBookForm(!showBookForm); setShowInviteForm(false); }}>
                    Book Appointment
                  </Button>
                  <Button size="xs" variant="outline" className="flex-1 text-[10px]" onClick={() => { setShowInviteForm(!showInviteForm); setShowBookForm(false); }}>
                    Send Invite
                  </Button>
                </div>

                {/* Inline Book Appointment Form */}
                {showBookForm && (
                  <form onSubmit={handleSidebarBook} className="space-y-2 border-t border-border/50 pt-2 animate-in fade-in duration-200">
                    <div className="space-y-0.5">
                      <Label htmlFor="side-doc" className="text-[10px]">Select Doctor</Label>
                      <select
                        id="side-doc"
                        className="w-full text-xs h-7 border border-input rounded-md px-1.5 bg-background"
                        required
                        value={bookingDocId}
                        onChange={(e) => setBookingDocId(e.target.value)}
                      >
                        <option value="">-- Choose Doctor --</option>
                        {doctors.map(d => (
                          <option key={d.id} value={d.id}>{d.name} ({d.department})</option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <div className="space-y-0.5">
                        <Label htmlFor="side-date" className="text-[10px]">Date</Label>
                        <Input id="side-date" type="date" required value={bookingDate} onChange={(e) => setBookingDate(e.target.value)} className="h-7 text-xs px-1.5" />
                      </div>
                      <div className="space-y-0.5">
                        <Label htmlFor="side-time" className="text-[10px]">Time</Label>
                        <Input id="side-time" type="time" required value={bookingTime} onChange={(e) => setBookingTime(e.target.value)} className="h-7 text-xs px-1.5" />
                      </div>
                    </div>
                    <div className="space-y-0.5">
                      <Label htmlFor="side-notes" className="text-[10px]">Consultation Notes</Label>
                      <Input id="side-notes" value={bookingNotes} onChange={(e) => setBookingNotes(e.target.value)} placeholder="Reason for booking..." className="h-7 text-xs px-1.5" />
                    </div>
                    <Button type="submit" size="xs" disabled={loadingForm} className="w-full text-[10px] h-7 mt-1">
                      {loadingForm ? "Booking..." : "Confirm & Notify WA"}
                    </Button>
                  </form>
                )}

                {/* Inline Invite Campaign Form */}
                {showInviteForm && (
                  <div className="space-y-2 border-t border-border/50 pt-2 animate-in fade-in duration-200">
                    <p className="text-[10px] text-muted-foreground">Select a doctor to send a WhatsApp booking invitation directly to this customer:</p>
                    <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                      {doctors.length === 0 ? (
                        <p className="text-[10px] text-muted-foreground text-center py-2">No active doctors available</p>
                      ) : (
                        doctors.map(d => (
                          <button
                            key={d.id}
                            type="button"
                            onClick={() => handleSidebarInvite(d.id)}
                            className="w-full text-left text-[11px] p-1.5 rounded bg-background border border-border hover:border-primary hover:text-primary transition-colors flex justify-between items-center"
                          >
                            <span>{d.name} ({d.department})</span>
                            <span className="text-[9px] uppercase font-bold bg-primary/10 px-1 rounded">Send</span>
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
          <div className="my-4 border-t border-border" />

          {/* Tags */}
          <div>
            <div className="flex items-center gap-2 px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <TagIcon className="h-3 w-3" />
              Tags
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {tags.length === 0 ? (
                <p className="px-1 text-xs text-muted-foreground">No tags</p>
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
          <div className="my-4 border-t border-border" />

          {/* Active Care Pipeline */}
          <div>
            <div className="flex items-center gap-2 px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <Activity className="h-3 w-3" />
              Patient Care Cycle
            </div>
            <div className="mt-2 space-y-2">
              {deals.length === 0 ? (
                <p className="px-1 text-xs text-muted-foreground">No active cycles</p>
              ) : (
                deals.map((deal) => (
                  <div
                    key={deal.id}
                    className="rounded-lg bg-muted px-3 py-2"
                  >
                    <p className="text-sm font-medium text-foreground">
                      {deal.title}
                    </p>
                    <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {deal.currency ?? "$"}
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
          <div className="my-4 border-t border-border" />

          {/* Notes */}
          <div>
            <div className="flex items-center gap-2 px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
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
                  className="flex-1 resize-none rounded-lg border border-border bg-muted px-3 py-2 text-xs text-foreground placeholder-muted-foreground outline-none focus:border-primary/50"
                />
                <Button
                  size="sm"
                  className="h-auto bg-primary px-2 hover:bg-primary/90"
                  onClick={handleAddNote}
                  disabled={!newNote.trim() || addingNote}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>

              <div className="mt-2 space-y-2">
                {notes.map((note) => (
                  <div
                    key={note.id}
                    className="rounded-lg bg-muted px-3 py-2"
                  >
                    <p className="whitespace-pre-wrap text-xs text-muted-foreground">
                      {note.note_text}
                    </p>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {format(new Date(note.created_at), "MMM d, yyyy HH:mm")}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>
  );

  if (isEmbedded) {
    return <div className="flex h-full flex-col">{content}</div>;
  }

  return (
    <div className="flex h-full w-70 flex-col border-l border-border bg-card">
      {content}
    </div>
  );
}
