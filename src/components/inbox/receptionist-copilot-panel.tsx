'use client';

import { useEffect, useMemo, useState } from 'react';
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
} from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCan } from '@/hooks/use-can';
import { cn } from '@/lib/utils';
import type { ReceptionistCopilotSnapshot } from '@/lib/ai/receptionist-copilot';
import type { Contact, Conversation, Message } from '@/types';

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
    <section className={cn('border-border/70 border-b px-4 py-3', className)}>
      <div className="text-muted-foreground mb-2 flex items-center gap-2 text-xs font-semibold uppercase">
        <Icon className="text-primary size-3.5" />
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
          className="border-border/60 bg-background/60 min-w-0 rounded-md border px-2 py-1.5"
        >
          <dt className="text-muted-foreground truncate text-[10px] font-medium uppercase">
            {row.label}
          </dt>
          <dd className="text-foreground mt-0.5 truncate text-xs font-medium">
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function EmptyLine({ children }: { children: React.ReactNode }) {
  return (
    <p className="border-border/70 bg-muted/30 text-muted-foreground rounded-md border border-dashed px-3 py-2 text-xs">
      {children}
    </p>
  );
}

function ConfidenceBar({ label, score }: { label: string; score: number }) {
  const safeScore = Math.max(0, Math.min(100, Math.round(score)));

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-foreground truncate font-medium">{label}</span>
        <span className="text-muted-foreground shrink-0 tabular-nums">
          {safeScore}%
        </span>
      </div>
      <div className="bg-muted h-1.5 overflow-hidden rounded-full">
        <div
          className={cn(
            'h-full rounded-full',
            safeScore >= 90
              ? 'bg-emerald-500'
              : safeScore >= 75
                ? 'bg-primary'
                : 'bg-amber-500'
          )}
          style={{ width: `${safeScore}%` }}
        />
      </div>
    </div>
  );
}

// Snapshot cache by conversation ID to allow instant loads on click
const copilotCache: Record<string, ReceptionistCopilotSnapshot> = {};

export function ReceptionistCopilotPanel({
  conversation,
  contact,
  messages,
  onInsertReply,
  isEmbedded,
}: ReceptionistCopilotPanelProps) {
  const canSend = useCan('send-messages');
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
      conversation?.id ?? 'none',
      messages.length,
      lastMessage?.id ?? '',
      lastMessage?.created_at ?? '',
      refreshNonce,
    ].join(':');
  }, [conversation?.id, messages, refreshNonce]);

  const snapshot =
    conversation && snapshotState?.conversationId === conversation.id
      ? snapshotState.snapshot
      : conversation
        ? copilotCache[conversation.id] || null
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

      fetch('/api/ai/receptionist-copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: conversation.id }),
        signal: controller.signal,
      })
        .then(async (response) => {
          const payload = (await response
            .json()
            .catch(() => ({}))) as CopilotResponse;
          if (!response.ok) {
            throw new Error(payload.error || `HTTP ${response.status}`);
          }
          if (!payload.snapshot) {
            throw new Error('Copilot response was empty');
          }
          setSnapshotState({
            conversationId: conversation.id,
            snapshot: payload.snapshot,
          });
          // Save to cache for instant load on next selection
          copilotCache[conversation.id] = payload.snapshot;
        })
        .catch((err) => {
          if (controller.signal.aborted) return;
          const message =
            err instanceof Error ? err.message : 'Failed to load copilot';
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
    toast.success('Suggested reply inserted');
  }

  if (!conversation || !contact) return null;

  const patientInfoRows = snapshot
    ? [
        field('Name', snapshot.patientInfo.patientName),
        field('Patient ID', snapshot.patientInfo.patientId),
        field('Phone', snapshot.patientInfo.phoneNumber),
        field('Age', snapshot.patientInfo.age),
        field('Gender', snapshot.patientInfo.gender),
        field('Language', snapshot.patientInfo.preferredLanguage),
        field('Doctor', snapshot.patientInfo.preferredDoctor),
        field('Department', snapshot.patientInfo.preferredDepartment),
      ]
    : [];

  const content = (
    <>
      <div className="border-border flex shrink-0 items-center justify-between gap-2 border-b px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Brain className="size-4 text-emerald-600 dark:text-emerald-400" />
            <h3 className="text-foreground truncate text-sm font-semibold">
              AI Receptionist Copilot
            </h3>
          </div>
          <div className="mt-1 flex items-center gap-1.5">
            <Badge variant="outline" className="h-4 px-1.5 text-[10px]">
              {snapshot?.generatedBy === 'openrouter' ? 'AI' : 'Rules'}
            </Badge>
            {snapshot && (
              <span className="text-muted-foreground text-[10px]">
                {new Date(snapshot.generatedAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
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
            <Loader2 className="text-primary size-5 animate-spin" />
            <p className="text-muted-foreground text-xs">
              Preparing patient context...
            </p>
          </div>
        ) : error && !snapshot ? (
          <div className="p-4">
            <div className="border-destructive/25 bg-destructive/10 text-destructive rounded-md border p-3 text-xs">
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
              <div className="border-border/70 text-muted-foreground border-b px-4 py-2 text-[11px]">
                <span className="inline-flex items-center gap-1.5">
                  <Loader2 className="size-3 animate-spin" />
                  Updating copilot
                </span>
              </div>
            )}

            <Section title="Patient Information" icon={UserRound}>
              <InfoGrid rows={patientInfoRows} />
            </Section>

            <Section title="Patient Summary" icon={ClipboardList}>
              <ul className="space-y-1.5">
                {snapshot.patientSummary.map((item) => (
                  <li key={item} className="text-foreground flex gap-2 text-xs">
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
                    field('Date', snapshot.lastVisit.date),
                    field('Doctor', snapshot.lastVisit.doctor),
                    field('Department', snapshot.lastVisit.department),
                    field('Status', snapshot.lastVisit.status),
                  ]}
                />
              ) : (
                <EmptyLine>
                  {snapshot.lastVisit.emptyMessage ||
                    'No previous visit recorded.'}
                </EmptyLine>
              )}
            </Section>

            <Section title="Upcoming Appointment" icon={Clock3}>
              {snapshot.upcomingAppointment.exists ? (
                <InfoGrid
                  rows={[
                    field('Date', snapshot.upcomingAppointment.date),
                    field('Time', snapshot.upcomingAppointment.time),
                    field('Doctor', snapshot.upcomingAppointment.doctor),
                    field(
                      'Department',
                      snapshot.upcomingAppointment.department
                    ),
                    field('Status', snapshot.upcomingAppointment.status),
                    field('Token', snapshot.upcomingAppointment.tokenNumber),
                    field('Queue', snapshot.upcomingAppointment.queuePosition),
                  ]}
                />
              ) : (
                <EmptyLine>
                  {snapshot.upcomingAppointment.emptyMessage ||
                    'No upcoming appointment found.'}
                </EmptyLine>
              )}
            </Section>

            <Section title="Latest Report Status" icon={FileText}>
              {snapshot.reportInfo.exists ? (
                <div className="space-y-2">
                  <InfoGrid
                    rows={[
                      field('Report', snapshot.reportInfo.name),
                      field('Status', snapshot.reportInfo.status),
                      field('Date', snapshot.reportInfo.date),
                    ]}
                  />
                  {snapshot.reportInfo.pdfUrl && (
                    <div className="pt-1">
                      <a
                        href={snapshot.reportInfo.pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-600 transition-colors hover:bg-emerald-500/20 dark:text-emerald-400"
                      >
                        <FileDown className="h-3.5 w-3.5" /> Download Report PDF
                      </a>
                    </div>
                  )}
                </div>
              ) : (
                <EmptyLine>
                  {snapshot.reportInfo.emptyMessage || 'No reports available.'}
                </EmptyLine>
              )}
            </Section>

            <Section title="Insurance Status" icon={ShieldCheck}>
              {snapshot.insuranceInfo.exists ? (
                <div className="space-y-2">
                  <InfoGrid
                    rows={[
                      field('Provider', snapshot.insuranceInfo.provider),
                      field(
                        'Cashless',
                        snapshot.insuranceInfo.cashlessAvailable
                      ),
                      field('Status', snapshot.insuranceInfo.status),
                    ]}
                  />
                  <p className="bg-muted/45 text-muted-foreground rounded-md px-3 py-2 text-xs leading-relaxed">
                    {snapshot.insuranceInfo.coverageNotes}
                  </p>
                </div>
              ) : (
                <EmptyLine>
                  {snapshot.insuranceInfo.emptyMessage ||
                    'No insurance information found.'}
                </EmptyLine>
              )}
            </Section>

            <Section title="AI Reply" icon={Sparkles}>
              <div className="space-y-2">
                <div className="border-border/70 bg-background/70 text-foreground rounded-md border p-3 text-xs leading-relaxed">
                  <p className="whitespace-pre-wrap">
                    {snapshot.suggestedReply}
                  </p>
                </div>
                <Button
                  size="sm"
                  className="w-full"
                  disabled={!canSend || !snapshot.suggestedReply}
                  onClick={handleInsertReply}
                >
                  <ClipboardCheck className="size-3.5" />
                  Insert AI Reply
                </Button>
              </div>
            </Section>

            <Section title="Next Steps" icon={Zap}>
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

            <Section title="Chat Summary" icon={MessageSquareReply}>
              <p className="text-foreground text-xs leading-relaxed whitespace-pre-wrap">
                {snapshot.conversationSummary}
              </p>
            </Section>

            <Section title="Staff Notes" icon={StickyNote}>
              {snapshot.internalNotes.length > 0 ? (
                <ul className="space-y-1.5">
                  {snapshot.internalNotes.map((note) => (
                    <li
                      key={note}
                      className="text-foreground text-xs leading-relaxed"
                    >
                      {note}
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyLine>No staff notes generated.</EmptyLine>
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

            <Section
              title="Patient Timeline"
              icon={Clock3}
              className="border-b-0"
            >
              {snapshot.timeline.length > 0 ? (
                <ol className="space-y-3">
                  {snapshot.timeline.map((item, index) => (
                    <li
                      key={`${item.date}-${item.title}-${index}`}
                      className="flex gap-2"
                    >
                      <div className="bg-primary mt-1 size-2 shrink-0 rounded-full" />
                      <div className="min-w-0">
                        <p className="text-muted-foreground text-[10px] font-medium uppercase">
                          {item.date}
                        </p>
                        <p className="text-foreground text-xs font-medium">
                          {item.title}
                        </p>
                        {item.detail && (
                          <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
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
    return (
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        {content}
      </div>
    );
  }

  return (
    <aside className="border-border bg-card hidden h-full min-h-0 w-80 shrink-0 flex-col overflow-hidden border-l lg:flex">
      {content}
    </aside>
  );
}
