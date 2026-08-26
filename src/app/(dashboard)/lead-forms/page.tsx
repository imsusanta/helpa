'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowDown,
  ArrowUp,
  ClipboardCheck,
  Copy,
  FilePlus2,
  FormInput,
  Loader2,
  Pencil,
  PauseCircle,
  PlayCircle,
  Plus,
  Trash2,
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
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useAuth } from '@/hooks/use-auth';
import { useWorkspace } from '@/hooks/use-workspace';
import {
  getSuggestedFormFields,
  validateSubmissionData,
} from '@/lib/marketing/form-fields';
import type { LeadForm, LeadFormField } from '@/types';

interface EnrichedLeadForm extends LeadForm {
  submission_count: number;
  new_leads_count: number;
}

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-primary/10 text-primary border-primary/20',
  paused: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  draft: 'bg-slate-500/10 text-muted-foreground border-slate-500/20',
};

export default function LeadFormsPage() {
  const { accountId, account } = useAuth();
  const { terminology } = useWorkspace();
  const pipelineItemsLower = terminology.pipelineItems.toLowerCase();
  const router = useRouter();

  const [forms, setForms] = useState<EnrichedLeadForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Builder dialog state
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingForm, setEditingForm] = useState<EnrichedLeadForm | null>(null);
  const [formName, setFormName] = useState('');
  const [fields, setFields] = useState<LeadFormField[]>([]);
  const [saving, setSaving] = useState(false);

  const [formToDelete, setFormToDelete] = useState<EnrichedLeadForm | null>(
    null
  );
  const [deleting, setDeleting] = useState(false);

  const fetchForms = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    setError(false);
    try {
      const res = await fetch('/api/lead-forms', {
        credentials: 'include',
        cache: 'no-store',
      });
      if (!res.ok) throw new Error('Failed');
      const payload = await res.json();
      setForms(payload.data ?? []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    void fetchForms();
  }, [fetchForms]);

  function openCreateDialog() {
    setEditingForm(null);
    setFormName('');
    // Industry-aware defaults from the workspace's own industry.
    setFields(getSuggestedFormFields(account?.industry ?? null));
    setBuilderOpen(true);
  }

  function openEditDialog(form: EnrichedLeadForm) {
    setEditingForm(form);
    setFormName(form.name);
    setFields(
      Array.isArray(form.fields)
        ? form.fields
        : getSuggestedFormFields(account?.industry ?? null)
    );
    setBuilderOpen(true);
  }

  async function saveForm(status: 'draft' | 'active') {
    if (!formName.trim()) {
      toast.error('Give your form a name first.');
      return;
    }
    setSaving(true);
    try {
      const body = JSON.stringify({
        name: formName.trim(),
        fields,
        status,
      });
      const res = editingForm
        ? await fetch(`/api/lead-forms/${editingForm.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body,
          })
        : await fetch('/api/lead-forms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body,
          });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || 'Save failed');
      }
      toast.success(
        status === 'active'
          ? `Form published — share the link to start capturing ${pipelineItemsLower}.`
          : 'Form saved as draft.'
      );
      setBuilderOpen(false);
      await fetchForms();
    } catch (err) {
      toast.error((err as Error).message || 'Unable to save the form.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(form: EnrichedLeadForm) {
    const next =
      form.status === 'active'
        ? 'paused'
        : form.status === 'paused'
          ? 'active'
          : 'active';
    try {
      const res = await fetch(`/api/lead-forms/${form.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error('Update failed');
      toast.success(next === 'active' ? 'Form is live.' : 'Form paused.');
      await fetchForms();
    } catch {
      toast.error('Unable to update the form status.');
    }
  }

  async function duplicateForm(form: EnrichedLeadForm) {
    try {
      const res = await fetch('/api/lead-forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: `${form.name} (Copy)`.slice(0, 120),
          description: form.description ?? undefined,
          fields: form.fields,
          success_message: form.success_message ?? undefined,
          status: 'draft',
        }),
      });
      if (!res.ok) throw new Error('Duplicate failed');
      toast.success('Form duplicated as draft.');
      await fetchForms();
    } catch {
      toast.error('Unable to duplicate the form.');
    }
  }

  async function deleteForm() {
    if (!formToDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/lead-forms/${formToDelete.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Delete failed');
      toast.success('Form deleted.');
      setFormToDelete(null);
      await fetchForms();
    } catch {
      toast.error('Unable to delete the form.');
    } finally {
      setDeleting(false);
    }
  }

  function publicUrl(form: Pick<EnrichedLeadForm, 'public_token'>): string {
    if (typeof window === 'undefined') return `/f/${form.public_token}`;
    return `${window.location.origin}/f/${form.public_token}`;
  }

  function moveField(index: number, direction: -1 | 1) {
    const next = [...fields];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setFields(next);
  }

  const totals = {
    active: forms.filter((f) => f.status === 'active').length,
    submissions: forms.reduce((sum, f) => sum + f.submission_count, 0),
    newLeads: forms.reduce((sum, f) => sum + f.new_leads_count, 0),
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 lg:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-foreground text-2xl font-bold">Lead Forms</h1>
          <p className="text-muted-foreground text-sm">
            Capture new {pipelineItemsLower} and send them directly into Helpa.
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
          Create Lead Form
        </Button>
      </div>

      {/* Loading skeletons */}
      {loading && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[72px] rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <ErrorState
          title="Unable to load lead forms"
          message="We couldn't load your lead forms right now."
          onRetry={() => void fetchForms()}
        />
      )}

      {/* Empty state */}
      {!loading && !error && forms.length === 0 && (
        <EmptyState
          icon={FormInput}
          title="No lead forms yet."
          description={`Create a form to start capturing new ${pipelineItemsLower}.`}
          actionLabel="Create Lead Form"
          onAction={openCreateDialog}
        />
      )}

      {/* Dashboard */}
      {!loading && !error && forms.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <div className="text-muted-foreground text-xs font-medium">
                  Active Forms
                </div>
                <div className="text-foreground text-xl font-bold tabular-nums">
                  {totals.active}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-muted-foreground text-xs font-medium">
                  Total Submissions
                </div>
                <div className="text-foreground text-xl font-bold tabular-nums">
                  {totals.submissions.toLocaleString()}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-muted-foreground text-xs font-medium">
                  New {terminology.pipelineItems}
                </div>
                <div className="text-foreground text-xl font-bold tabular-nums">
                  {totals.newLeads.toLocaleString()}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-muted-foreground text-xs font-medium">
                  Conversion Rate
                </div>
                <div className="text-foreground text-xl font-bold tabular-nums">
                  {totals.submissions > 0
                    ? Math.round((totals.newLeads / totals.submissions) * 100)
                    : 0}
                  %
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Desktop table */}
          <Card className="hidden md:block">
            <CardHeader>
              <CardTitle className="text-base">Your Forms</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Form Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Submissions</TableHead>
                    <TableHead className="text-right">
                      New {terminology.pipelineItems}
                    </TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {forms.map((form) => (
                    <TableRow key={form.id}>
                      <TableCell>
                        <Link
                          href={`/lead-forms/${form.id}`}
                          className="hover:text-primary text-sm font-medium underline-offset-4 hover:underline"
                        >
                          {form.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${STATUS_STYLES[form.status] ?? STATUS_STYLES.draft}`}
                        >
                          {form.status === 'active' && '●'}
                          {form.status === 'paused' && '⏸'}
                          {form.status === 'draft' && '○'}
                          <span className="capitalize">{form.status}</span>
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {form.submission_count.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {form.new_leads_count.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(form.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={`View ${form.name}`}
                            title="View submissions"
                            onClick={() =>
                              router.push(`/lead-forms/${form.id}`)
                            }
                          >
                            <ClipboardCheck className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={`Edit ${form.name}`}
                            title="Edit"
                            onClick={() => openEditDialog(form)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={`Copy link for ${form.name}`}
                            title="Copy public link"
                            disabled={form.status !== 'active'}
                            onClick={async () => {
                              await navigator.clipboard.writeText(
                                publicUrl(form)
                              );
                              toast.success('Public link copied.');
                            }}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={
                              form.status === 'active'
                                ? `Pause ${form.name}`
                                : `Activate ${form.name}`
                            }
                            title={
                              form.status === 'active'
                                ? 'Pause form'
                                : 'Activate / resume form'
                            }
                            onClick={() => void toggleStatus(form)}
                          >
                            {form.status === 'active' ? (
                              <PauseCircle className="h-4 w-4" />
                            ) : (
                              <PlayCircle className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={`Duplicate ${form.name}`}
                            title="Duplicate"
                            onClick={() => void duplicateForm(form)}
                          >
                            <FilePlus2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={`Delete ${form.name}`}
                            title="Delete (admins)"
                            onClick={() => setFormToDelete(form)}
                          >
                            <Trash2 className="text-destructive h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {forms.map((form) => (
              <Card key={form.id}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <Link
                      href={`/lead-forms/${form.id}`}
                      className="text-sm font-semibold underline-offset-4 hover:underline"
                    >
                      {form.name}
                    </Link>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[11px] capitalize ${STATUS_STYLES[form.status] ?? STATUS_STYLES.draft}`}
                    >
                      {form.status}
                    </span>
                  </div>
                  <div className="text-muted-foreground grid grid-cols-2 gap-x-4 text-xs">
                    <span>
                      Submissions: {form.submission_count.toLocaleString()}
                    </span>
                    <span>
                      New {terminology.pipelineItems}:{' '}
                      {form.new_leads_count.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => openEditDialog(form)}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      disabled={form.status !== 'active'}
                      onClick={async () => {
                        await navigator.clipboard.writeText(publicUrl(form));
                        toast.success('Public link copied.');
                      }}
                    >
                      Copy Link
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Builder dialog */}
      <Dialog open={builderOpen} onOpenChange={setBuilderOpen}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingForm ? 'Edit Lead Form' : 'New Lead Form'}
            </DialogTitle>
            <DialogDescription>
              Pick the fields customers fill in. Suggestions are tailored to
              your {(account?.industry || 'workspace').replace(/_/g, ' ')}{' '}
              workspace.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="lead-form-name">Form Name</Label>
              <Input
                id="lead-form-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Free Consultation"
                maxLength={120}
              />
            </div>

            <div>
              <Label>Form Fields</Label>
              <div className="space-y-2">
                {fields.map((field, index) => (
                  <div
                    key={field.key}
                    className="border-border flex items-center gap-2 rounded-lg border p-2"
                  >
                    <div className="flex flex-col">
                      <button
                        type="button"
                        aria-label={`Move ${field.label} up`}
                        disabled={index === 0}
                        onClick={() => moveField(index, -1)}
                        className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Move ${field.label} down`}
                        disabled={index === fields.length - 1}
                        onClick={() => moveField(index, 1)}
                        className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <Checkbox
                      id={`req-${field.key}`}
                      checked={field.required}
                      onCheckedChange={(checked) => {
                        const next = [...fields];
                        next[index] = {
                          ...field,
                          required: checked === true,
                        };
                        setFields(next);
                      }}
                      aria-label={`Make ${field.label} required`}
                    />
                    <Label
                      htmlFor={`req-${field.key}`}
                      className="flex-1 cursor-pointer text-sm"
                    >
                      {field.label}
                      <span className="text-muted-foreground ml-2 text-xs normal-case">
                        ({field.type}
                        {field.required ? ', required' : ''})
                      </span>
                    </Label>
                    {/* Name and Phone are structural — cannot be removed. */}
                    {field.key !== 'name' && field.key !== 'phone' && (
                      <button
                        type="button"
                        aria-label={`Remove ${field.label}`}
                        onClick={() =>
                          setFields(fields.filter((f) => f.key !== field.key))
                        }
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <AddFieldButton
                onAdd={(f) => setFields([...fields, f])}
                existingKeys={fields.map((f) => f.key)}
              />

              {/* Live preview of a filled example */}
              <div className="bg-muted/40 mt-3 rounded-lg p-3">
                <div className="text-muted-foreground mb-1 text-xs font-semibold tracking-wide uppercase">
                  Preview
                </div>
                <PreviewBlock name={formName || 'Your form'} fields={fields} />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              disabled={saving}
              onClick={() => void saveForm('draft')}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Draft
            </Button>
            <Button disabled={saving} onClick={() => void saveForm('active')}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Publish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={Boolean(formToDelete)}
        onOpenChange={(open) => !open && setFormToDelete(null)}
        title="Delete this lead form?"
        description={`This permanently deletes "${formToDelete?.name}" and all of its submission history. Existing ${terminology.contacts.toLowerCase()} and ${pipelineItemsLower} are kept.`}
        confirmText={deleting ? 'Deleting…' : 'Delete Form'}
        loading={deleting}
        onConfirm={() => void deleteForm()}
      />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────── */

function AddFieldButton({
  onAdd,
  existingKeys,
}: {
  onAdd: (field: LeadFormField) => void;
  existingKeys: string[];
}) {
  const EXTRA_FIELDS: LeadFormField[] = [
    { key: 'email', label: 'Email', type: 'email', required: false },
    { key: 'message', label: 'Message', type: 'textarea', required: false },
    { key: 'company', label: 'Company', type: 'text', required: false },
    { key: 'service', label: 'Service', type: 'text', required: false },
    {
      key: 'preferred_date',
      label: 'Preferred Date',
      type: 'date',
      required: false,
    },
    { key: 'guests', label: 'Guests', type: 'number', required: false },
    { key: 'budget', label: 'Budget', type: 'text', required: false },
    { key: 'destination', label: 'Destination', type: 'text', required: false },
    {
      key: 'membership_type',
      label: 'Membership Type',
      type: 'text',
      required: false,
    },
    { key: 'course', label: 'Course', type: 'text', required: false },
  ];

  const available = EXTRA_FIELDS.filter((f) => !existingKeys.includes(f.key));

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {available.map((f) => (
        <Button
          key={f.key}
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onAdd({ ...f })}
        >
          <Plus className="mr-1 h-3.5 w-3.5" /> {f.label}
        </Button>
      ))}
    </div>
  );
}

/**
 * Renders a read-only mock of the public form using the same validation
 * rules the server applies — what the owner previews is what leads get.
 */
function PreviewBlock({
  name,
  fields,
}: {
  name: string;
  fields: LeadFormField[];
}) {
  const sampleData: Record<string, string> = { name: 'Rahul' };
  for (const f of fields) {
    if (f.key === 'name') continue;
    sampleData[f.key] =
      f.type === 'date'
        ? '2026-09-01'
        : f.type === 'email'
          ? 'rahul@example.com'
          : f.type === 'phone'
            ? '+919876543210'
            : f.type === 'number'
              ? '2'
              : `Sample ${f.label}`;
  }
  const { violations } = validateSubmissionData(fields, sampleData);

  return (
    <div className="space-y-1 text-sm">
      <div className="font-medium">{name}</div>
      <ul className="text-muted-foreground space-y-0.5 text-xs">
        {fields.map((f) => (
          <li key={f.key}>
            {sampleData[f.key] ? (
              <>
                <span className="text-foreground">{sampleData[f.key]}</span>{' '}
                <span className="opacity-60">← {f.label}</span>
              </>
            ) : (
              <em className="opacity-60">{f.label}…</em>
            )}
          </li>
        ))}
      </ul>
      {violations.length > 0 && (
        <div className="text-destructive text-xs">{violations[0].message}</div>
      )}
    </div>
  );
}
