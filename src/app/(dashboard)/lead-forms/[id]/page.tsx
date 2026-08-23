'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ClipboardCheck,
  Copy,
  ExternalLink,
  PauseCircle,
  PlayCircle,
  UserPlus,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { useAuth } from '@/hooks/use-auth';
import type { FormSubmission, LeadForm } from '@/types';

interface FormDetailResponse {
  data: LeadForm & {
    submission_count: number;
    leads_created_count: number;
  };
}

interface SubmissionsResponse {
  data: {
    form_name: string;
    submissions: FormSubmission[];
    total: number;
    limit: number;
    offset: number;
  };
}

interface MemberRow {
  user_id: string;
  full_name: string | null;
}

const SUBMISSION_STATUS_STYLES: Record<string, string> = {
  new: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  contacted: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  converted: 'bg-primary/10 text-primary border-primary/20',
  archived: 'bg-slate-500/10 text-muted-foreground border-slate-500/20',
};

const FORM_STATUS_STYLES: Record<string, string> = {
  active: 'bg-primary/10 text-primary border-primary/20',
  paused: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  draft: 'bg-slate-500/10 text-muted-foreground border-slate-500/20',
};

export default function LeadFormDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { accountId } = useAuth();

  const [form, setForm] = useState<
    | (LeadForm & { submission_count: number; leads_created_count: number })
    | null
  >(null);
  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchDetail = useCallback(async () => {
    if (!accountId || !id) return;
    setLoading(true);
    setError(false);
    try {
      const [formRes, subsRes] = await Promise.all([
        fetch(`/api/lead-forms/${id}`, {
          credentials: 'include',
          cache: 'no-store',
        }),
        fetch(`/api/lead-forms/${id}/submissions`, {
          credentials: 'include',
          cache: 'no-store',
        }),
      ]);
      if (!formRes.ok || !subsRes.ok) throw new Error('Failed');
      const formPayload = (await formRes.json()) as FormDetailResponse;
      const subsPayload = (await subsRes.json()) as SubmissionsResponse;
      setForm(formPayload.data);
      setSubmissions(subsPayload.data.submissions ?? []);
      setTotal(subsPayload.data.total ?? 0);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [accountId, id]);

  useEffect(() => {
    void fetchDetail();
  }, [fetchDetail]);

  async function updateSubmission(
    submissionId: string,
    patch: { status?: string }
  ) {
    try {
      const res = await fetch(`/api/lead-forms/${id}/submissions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ submission_id: submissionId, ...patch }),
      });
      if (!res.ok) throw new Error('Failed');
      await fetchDetail();
    } catch {
      toast.error('Unable to update the submission.');
    }
  }

  async function assignContact(contactId: string, userId: string) {
    try {
      const res = await fetch('/api/contacts/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'assign',
          contact_ids: [contactId],
          payload: { assigned_user_id: userId },
        }),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success('Contact assigned.');
      await fetchDetail();
    } catch {
      toast.error('Unable to assign the contact.');
    }
  }

  async function createFollowUp(contactId: string) {
    // Due tomorrow by default — adjustable on the follow-ups board.
    const due = new Date();
    due.setDate(due.getDate() + 1);
    try {
      const res = await fetch('/api/followups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          contact_id: contactId,
          title: 'Follow up on lead form enquiry',
          due_date: due.toISOString().slice(0, 10),
        }),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success('Follow-up created — find it on the Follow-ups board.');
    } catch {
      toast.error('Unable to create the follow-up.');
    }
  }

  async function toggleFormStatus() {
    if (!form) return;
    const next = form.status === 'active' ? 'paused' : 'active';
    try {
      const res = await fetch(`/api/lead-forms/${form.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success(next === 'active' ? 'Form is live.' : 'Form paused.');
      await fetchDetail();
    } catch {
      toast.error('Unable to update the form status.');
    }
  }

  function publicUrl(): string {
    if (!form) return '';
    if (typeof window === 'undefined') return `/f/${form.public_token}`;
    return `${window.location.origin}/f/${form.public_token}`;
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 p-4 lg:p-6">
        <Skeleton className="h-9 w-64 rounded-lg" />
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-[72px] rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    );
  }

  if (error && !form) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 p-4 lg:p-6">
        <ErrorState
          title="Unable to load this form"
          message="We couldn't load the form details right now."
          onRetry={() => void fetchDetail()}
        />
      </div>
    );
  }

  if (!form) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 p-4 lg:p-6">
        <EmptyState
          icon={ClipboardCheck}
          title="Form not found."
          description="This form may have been deleted or belongs to another workspace."
          actionLabel="Back to Lead Forms"
          onAction={() => router.push('/lead-forms')}
        />
      </div>
    );
  }

  const conversion =
    form.submission_count > 0
      ? Math.round((form.leads_created_count / form.submission_count) * 100)
      : 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 lg:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Button
            onClick={() => router.push('/lead-forms')}
            variant="outline"
            size="icon"
            className="h-8 w-8 shrink-0 rounded-full"
            aria-label="Back to lead forms"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-foreground text-2xl font-bold">
                {form.name}
              </h1>
              <span
                className={`rounded-full border px-2 py-0.5 text-[11px] capitalize ${FORM_STATUS_STYLES[form.status] ?? FORM_STATUS_STYLES.draft}`}
              >
                {form.status}
              </span>
            </div>
            {form.description && (
              <p className="text-muted-foreground mt-1 text-sm">
                {form.description}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={form.status !== 'active'}
            onClick={async () => {
              await navigator.clipboard.writeText(publicUrl());
              toast.success('Public link copied.');
            }}
          >
            <Copy className="mr-2 h-4 w-4" aria-hidden="true" />
            Copy Link
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={form.status !== 'active'}
            onClick={async () => {
              await navigator.clipboard.writeText(
                `<iframe src="${publicUrl()}" width="100%" height="600" style="border:0"></iframe>`
              );
              toast.success('Embed snippet copied.');
            }}
          >
            <Copy className="mr-2 h-4 w-4" aria-hidden="true" />
            Embed
          </Button>
          {form.status !== 'draft' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void toggleFormStatus()}
            >
              {form.status === 'active' ? (
                <>
                  <PauseCircle className="mr-2 h-4 w-4" /> Pause
                </>
              ) : (
                <>
                  <PlayCircle className="mr-2 h-4 w-4" /> Activate
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {form.status === 'paused' && (
        <Card>
          <CardContent className="text-muted-foreground p-3 text-sm">
            ⏸ This form is currently unavailable — the public link shows
            “unavailable” until you activate it.
          </CardContent>
        </Card>
      )}

      {/* Analytics */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-muted-foreground text-xs font-medium">
              Submissions
            </div>
            <div className="text-foreground text-xl font-bold tabular-nums">
              {form.submission_count.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-muted-foreground text-xs font-medium">
              Leads Created
            </div>
            <div className="text-foreground text-xl font-bold tabular-nums">
              {form.leads_created_count.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-muted-foreground text-xs font-medium">
              Conversion Rate
            </div>
            <div className="text-foreground text-xl font-bold tabular-nums">
              {conversion}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Submissions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Submissions</CardTitle>
        </CardHeader>
        <CardContent>
          {submissions.length === 0 ? (
            <EmptyState
              icon={ClipboardCheck}
              title="No submissions yet."
              description={
                form.status === 'active'
                  ? 'Share your form link to start capturing leads.'
                  : 'Activate this form and share the link to start capturing leads.'
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="hidden md:table-cell">
                    Details
                  </TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {submissions.map((submission) => (
                  <TableRow key={submission.id}>
                    <TableCell className="text-sm font-medium">
                      {String(submission.data?.name ?? 'Unknown')}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {String(
                        submission.contact?.phone ??
                          submission.data?.phone ??
                          '—'
                      )}
                    </TableCell>
                    <TableCell className="hidden max-w-[220px] truncate text-xs md:table-cell">
                      {Object.entries(submission.data ?? {})
                        .filter(([key]) => key !== 'name' && key !== 'phone')
                        .map(([key, value]) => `${key}: ${value}`)
                        .join(' · ') || '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {new Date(submission.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[11px] capitalize ${SUBMISSION_STATUS_STYLES[submission.status] ?? SUBMISSION_STATUS_STYLES.archived}`}
                      >
                        {submission.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {submission.contact_id && (
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button size="sm" variant="outline">
                                Actions
                              </Button>
                            }
                          />
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() =>
                                router.push(
                                  `/contacts?id=${submission.contact_id}`
                                )
                              }
                            >
                              <ExternalLink className="mr-2 h-4 w-4" /> Open
                              Contact
                            </DropdownMenuItem>
                            <AssignMenuItem
                              onAssign={(userId) =>
                                void assignContact(
                                  submission.contact_id as string,
                                  userId
                                )
                              }
                            />
                            <DropdownMenuItem
                              onClick={() =>
                                void createFollowUp(
                                  submission.contact_id as string
                                )
                              }
                            >
                              <UserPlus className="mr-2 h-4 w-4" /> Create
                              Follow-up
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuLabel className="text-xs">
                              Mark as
                            </DropdownMenuLabel>
                            {['contacted', 'converted', 'archived'].map(
                              (status) => (
                                <DropdownMenuItem
                                  key={status}
                                  disabled={submission.status === status}
                                  onClick={() =>
                                    void updateSubmission(submission.id, {
                                      status,
                                    })
                                  }
                                  className="capitalize"
                                >
                                  {status}
                                </DropdownMenuItem>
                              )
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {total > submissions.length && (
            <p className="text-muted-foreground mt-3 text-center text-xs">
              Showing {submissions.length} of {total.toLocaleString()}{' '}
              submissions.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Loads the workspace member list once and renders an "Assign to…"
 * submenu reusing the existing contacts/bulk assignment API.
 */
function AssignMenuItem({ onAssign }: { onAssign: (userId: string) => void }) {
  const [members, setMembers] = useState<MemberRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/account/members', {
          credentials: 'include',
          cache: 'no-store',
        });
        if (!res.ok) return;
        const payload = await res.json();
        if (!cancelled) setMembers(payload.data ?? payload.members ?? []);
      } catch {
        // Non-critical; assignment falls back to manual CRM workflow.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (members.length === 0) return null;

  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuLabel className="text-xs">
        Assign contact to
      </DropdownMenuLabel>
      {members.slice(0, 8).map((m) => (
        <DropdownMenuItem key={m.user_id} onClick={() => onAssign(m.user_id)}>
          {m.full_name || m.user_id.slice(0, 8)}
        </DropdownMenuItem>
      ))}
    </>
  );
}
