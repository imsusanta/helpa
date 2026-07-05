"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Brain,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  FileText,
  FileDown,
  Loader2,
  MessageSquareReply,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  StickyNote,
  TrendingUp,
  UserRound,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCan } from "@/hooks/use-can";
import { cn } from "@/lib/utils";
import type { ReceptionistCopilotSnapshot } from "@/lib/ai/receptionist-copilot";
import type { Contact, Conversation, Message } from "@/types";

interface ReceptionistCopilotPanelProps {
  conversation: Conversation | null;
  contact: Contact | null;
  messages: Message[];
  onInsertReply: (reply: string) => void;
  isEmbedded?: boolean;
}

interface CopilotResponse {
  snapshot?: ReceptionistCopilotSnapshot;
  error?: string;
}

function field(label: string, value: string) {
  return { label, value };
}

function Section({
  title,
  icon: Icon,
  children,
  className,
}: {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("border-b border-border/70 px-4 py-3", className)}>
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
        <Icon className="size-3.5 text-primary" />
        <span>{title}</span>
      </div>
      {children}
    </section>
  );
}

function InfoGrid({ rows }: { rows: Array<{ label: string; value: string }> }) {
  return (
    <dl className="grid grid-cols-2 gap-2">
      {rows.map((row) => (
        <div
          key={row.label}
          className="min-w-0 rounded-md border border-border/60 bg-background/60 px-2 py-1.5"
        >
          <dt className="truncate text-[10px] font-medium uppercase text-muted-foreground">
            {row.label}
          </dt>
          <dd className="mt-0.5 truncate text-xs font-medium text-foreground">
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function EmptyLine({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md border border-dashed border-border/70 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
      {children}
    </p>
  );
}

function ConfidenceBar({ label, score }: { label: string; score: number }) {
  const safeScore = Math.max(0, Math.min(100, Math.round(score)));

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="truncate font-medium text-foreground">{label}</span>
        <span className="shrink-0 tabular-nums text-muted-foreground">
          {safeScore}%
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full",
            safeScore >= 90
              ? "bg-emerald-500"
              : safeScore >= 75
                ? "bg-primary"
                : "bg-amber-500",
          )}
          style={{ width: `${safeScore}%` }}
        />
      </div>
    </div>
  );
}

export function ReceptionistCopilotPanel({
  conversation,
  contact,
  messages,
  onInsertReply,
  isEmbedded,
}: ReceptionistCopilotPanelProps) {
  const canSend = useCan("send-messages");
  const [snapshotState, setSnapshotState] = useState<{
    conversationId: string;
    snapshot: ReceptionistCopilotSnapshot;
  } | null>(null);
  const [errorState, setErrorState] = useState<{
    conversationId: string;
    message: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);

  const messageFingerprint = useMemo(() => {
    const lastMessage = messages[messages.length - 1];
    return [
      conversation?.id ?? "none",
      messages.length,
      lastMessage?.id ?? "",
      lastMessage?.created_at ?? "",
      refreshNonce,
    ].join(":");
  }, [conversation?.id, messages, refreshNonce]);

  const snapshot =
    conversation && snapshotState?.conversationId === conversation.id
      ? snapshotState.snapshot
      : null;
  const error =
    conversation && errorState?.conversationId === conversation.id
      ? errorState.message
      : null;

  useEffect(() => {
    if (!conversation) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      setErrorState(null);

      fetch("/api/ai/receptionist-copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: conversation.id }),
        signal: controller.signal,
      })
        .then(async (response) => {
          const payload = (await response.json().catch(() => ({}))) as CopilotResponse;
          if (!response.ok) {
            throw new Error(payload.error || `HTTP ${response.status}`);
          }
          if (!payload.snapshot) {
            throw new Error("Copilot response was empty");
          }
          setSnapshotState({
            conversationId: conversation.id,
            snapshot: payload.snapshot,
          });
        })
        .catch((err) => {
          if (controller.signal.aborted) return;
          const message =
            err instanceof Error ? err.message : "Failed to load copilot";
          setErrorState({ conversationId: conversation.id, message });
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 250);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [conversation, messageFingerprint]);

  function handleInsertReply() {
    if (!snapshot?.suggestedReply || !canSend) return;
    onInsertReply(snapshot.suggestedReply);
    toast.success("Suggested reply inserted");
  }

  if (!conversation || !contact) return null;

  const patientInfoRows = snapshot
    ? [
        field("Name", snapshot.patientInfo.patientName),
        field("Patient ID", snapshot.patientInfo.patientId),
        field("Phone", snapshot.patientInfo.phoneNumber),
        field("Age", snapshot.patientInfo.age),
        field("Gender", snapshot.patientInfo.gender),
        field("Language", snapshot.patientInfo.preferredLanguage),
        field("Doctor", snapshot.patientInfo.preferredDoctor),
        field("Department", snapshot.patientInfo.preferredDepartment),
      ]
    : [];

  const content = (
    <>
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Brain className="size-4 text-emerald-600 dark:text-emerald-400" />
            <h3 className="truncate text-sm font-semibold text-foreground">
              AI Receptionist Copilot
            </h3>
          </div>
          <div className="mt-1 flex items-center gap-1.5">
            <Badge variant="outline" className="h-4 px-1.5 text-[10px]">
              {snapshot?.generatedBy === "openrouter" ? "AI" : "Rules"}
            </Badge>
            {snapshot && (
              <span className="text-[10px] text-muted-foreground">
                {new Date(snapshot.generatedAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={loading}
          onClick={() => setRefreshNonce((value) => value + 1)}
          title="Refresh copilot"
        >
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading && !snapshot ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3 px-6 text-center">
            <Loader2 className="size-5 animate-spin text-primary" />
            <p className="text-xs text-muted-foreground">
              Preparing patient context...
            </p>
          </div>
        ) : error && !snapshot ? (
          <div className="p-4">
            <div className="rounded-md border border-destructive/25 bg-destructive/10 p-3 text-xs text-destructive">
              {error}
            </div>
          </div>
        ) : snapshot ? (
          <div>
            {snapshot.warning && (
              <div className="border-b border-amber-500/20 bg-amber-500/10 px-4 py-2 text-xs text-amber-500">
                <div className="flex gap-2">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                  <span>{snapshot.warning}</span>
                </div>
              </div>
            )}

            {loading && (
              <div className="border-b border-border/70 px-4 py-2 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Loader2 className="size-3 animate-spin" />
                  Updating copilot
                </span>
              </div>
            )}

            <Section title="Patient Information" icon={UserRound}>
              <InfoGrid rows={patientInfoRows} />
            </Section>

            <Section title="AI Summary" icon={ClipboardList}>
              <ul className="space-y-1.5">
                {snapshot.patientSummary.map((item) => (
                  <li key={item} className="flex gap-2 text-xs text-foreground">
                    <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
                    <span className="leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </Section>

            <Section title="Last Visit" icon={CalendarDays}>
              {snapshot.lastVisit.exists ? (
                <InfoGrid
                  rows={[
                    field("Date", snapshot.lastVisit.date),
                    field("Doctor", snapshot.lastVisit.doctor),
                    field("Department", snapshot.lastVisit.department),
                    field("Status", snapshot.lastVisit.status),
                  ]}
                />
              ) : (
                <EmptyLine>
                  {snapshot.lastVisit.emptyMessage || "No previous visit recorded."}
                </EmptyLine>
              )}
            </Section>

            <Section title="Upcoming Appointment" icon={Clock3}>
              {snapshot.upcomingAppointment.exists ? (
                <InfoGrid
                  rows={[
                    field("Date", snapshot.upcomingAppointment.date),
                    field("Time", snapshot.upcomingAppointment.time),
                    field("Doctor", snapshot.upcomingAppointment.doctor),
                    field("Department", snapshot.upcomingAppointment.department),
                    field("Status", snapshot.upcomingAppointment.status),
                    field("Token", snapshot.upcomingAppointment.tokenNumber),
                    field("Queue", snapshot.upcomingAppointment.queuePosition),
                  ]}
                />
              ) : (
                <EmptyLine>
                  {snapshot.upcomingAppointment.emptyMessage ||
                    "No upcoming appointment found."}
                </EmptyLine>
              )}
            </Section>

            <Section title="Reports" icon={FileText}>
              {snapshot.reportInfo.exists ? (
                <div className="space-y-2">
                  <InfoGrid
                    rows={[
                      field("Report", snapshot.reportInfo.name),
                      field("Status", snapshot.reportInfo.status),
                      field("Date", snapshot.reportInfo.date),
                    ]}
                  />
                  {snapshot.reportInfo.pdfUrl && (
                    <div className="pt-1">
                      <a
                        href={snapshot.reportInfo.pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-semibold text-[10px] px-2.5 py-1 transition-colors"
                      >
                        <FileDown className="h-3.5 w-3.5" /> Download Report PDF
                      </a>
                    </div>
                  )}
                </div>
              ) : (
                <EmptyLine>
                  {snapshot.reportInfo.emptyMessage || "No reports available."}
                </EmptyLine>
              )}
            </Section>

            <Section title="Insurance" icon={ShieldCheck}>
              {snapshot.insuranceInfo.exists ? (
                <div className="space-y-2">
                  <InfoGrid
                    rows={[
                      field("Provider", snapshot.insuranceInfo.provider),
                      field("Cashless", snapshot.insuranceInfo.cashlessAvailable),
                      field("Status", snapshot.insuranceInfo.status),
                    ]}
                  />
                  <p className="rounded-md bg-muted/45 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                    {snapshot.insuranceInfo.coverageNotes}
                  </p>
                </div>
              ) : (
                <EmptyLine>
                  {snapshot.insuranceInfo.emptyMessage ||
                    "No insurance information found."}
                </EmptyLine>
              )}
            </Section>

            <Section title="Conversation Summary" icon={MessageSquareReply}>
              <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground">
                {snapshot.conversationSummary}
              </p>
            </Section>

            <Section title="Suggested Reply" icon={Sparkles}>
              <div className="space-y-2">
                <div className="rounded-md border border-border/70 bg-background/70 p-3 text-xs leading-relaxed text-foreground">
                  <p className="whitespace-pre-wrap">{snapshot.suggestedReply}</p>
                </div>
                <Button
                  size="sm"
                  className="w-full"
                  disabled={!canSend || !snapshot.suggestedReply}
                  onClick={handleInsertReply}
                >
                  <ClipboardCheck className="size-3.5" />
                  Insert Reply
                </Button>
              </div>
            </Section>

            <Section title="Suggested Actions" icon={Zap}>
              <div className="flex flex-wrap gap-1.5">
                {snapshot.suggestedActions.map((action) => (
                  <Badge
                    key={action}
                    variant="outline"
                    className="h-auto rounded-md px-2 py-1 text-[11px]"
                  >
                    {action}
                  </Badge>
                ))}
              </div>
            </Section>

            <Section title="Internal Notes" icon={StickyNote}>
              {snapshot.internalNotes.length > 0 ? (
                <ul className="space-y-1.5">
                  {snapshot.internalNotes.map((note) => (
                    <li key={note} className="text-xs leading-relaxed text-foreground">
                      {note}
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyLine>No internal notes generated.</EmptyLine>
              )}
            </Section>

            <Section title="AI Confidence" icon={TrendingUp}>
              <div className="space-y-3">
                <ConfidenceBar
                  label={snapshot.intent.label}
                  score={snapshot.intent.score}
                />
                {snapshot.confidence
                  .filter((item) => item.label !== snapshot.intent.label)
                  .slice(0, 3)
                  .map((item) => (
                    <ConfidenceBar
                      key={item.label}
                      label={item.label}
                      score={item.score}
                    />
                  ))}
              </div>
            </Section>

            <Section title="Patient Timeline" icon={Clock3} className="border-b-0">
              {snapshot.timeline.length > 0 ? (
                <ol className="space-y-3">
                  {snapshot.timeline.map((item, index) => (
                    <li
                      key={`${item.date}-${item.title}-${index}`}
                      className="flex gap-2"
                    >
                      <div className="mt-1 size-2 shrink-0 rounded-full bg-primary" />
                      <div className="min-w-0">
                        <p className="text-[10px] font-medium uppercase text-muted-foreground">
                          {item.date}
                        </p>
                        <p className="text-xs font-medium text-foreground">
                          {item.title}
                        </p>
                        {item.detail && (
                          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                            {item.detail}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <EmptyLine>No patient activity timeline yet.</EmptyLine>
              )}
            </Section>
          </div>
        ) : null}
      </div>
    </>
  );

  if (isEmbedded) {
    return <div className="flex h-full flex-col min-h-0 overflow-hidden">{content}</div>;
  }

  return (
    <aside className="hidden h-full w-80 shrink-0 flex-col border-l border-border bg-card lg:flex min-h-0 overflow-hidden">
      {content}
    </aside>
  );
}
