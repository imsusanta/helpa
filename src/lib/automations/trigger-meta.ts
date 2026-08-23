import type { AutomationTriggerType } from '@/types';

export interface TriggerMeta {
  label: string;
  /** Tailwind classes for the Badge pill on the list row. */
  pillClass: string;
}

export const TRIGGER_META: Record<AutomationTriggerType, TriggerMeta> = {
  new_message_received: {
    label: 'New Message',
    pillClass: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
  },
  first_inbound_message: {
    label: 'First Message from Contact',
    pillClass: 'border-teal-500/30 bg-teal-500/10 text-teal-300',
  },
  keyword_match: {
    label: 'Keyword Match',
    pillClass: 'border-purple-500/30 bg-purple-500/10 text-purple-300',
  },
  new_contact_created: {
    label: 'New Contact',
    pillClass: 'border-primary/30 bg-primary/10 text-primary',
  },
  conversation_assigned: {
    label: 'Conversation Assigned',
    pillClass: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
  },
  tag_added: {
    label: 'Tag Added',
    pillClass: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  },
  time_based: {
    label: 'Time-Based',
    pillClass: 'border-slate-500/30 bg-slate-500/10 text-muted-foreground',
  },
  form_submitted: {
    label: 'Form Submitted',
    pillClass: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300',
  },
  appointment_created: {
    label: 'Appointment Booked',
    pillClass: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  },
  appointment_reminder: {
    label: 'Appointment Reminder',
    pillClass: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
  },
  appointment_cancelled: {
    label: 'Appointment Cancelled',
    pillClass: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
  },
};

const FALLBACK_PILL =
  'border-slate-500/30 bg-slate-500/10 text-muted-foreground';

/** "some_unknown_trigger" -> "Some Unknown Trigger". */
function humanize(value: string): string {
  return value
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * `trigger_type` is a plain `text` column with no CHECK constraint, and the
 * industry workflow packs under `src/modules/*\/workflows.ts` seed their own
 * strings, so a row can legitimately carry a trigger this build has never
 * heard of. Those get a humanised label instead of a raw slug.
 */
export function triggerMeta(
  t: AutomationTriggerType | string | null | undefined
): TriggerMeta {
  if (!t) return { label: 'Unknown Trigger', pillClass: FALLBACK_PILL };
  return (
    TRIGGER_META[t as AutomationTriggerType] ?? {
      label: humanize(t),
      pillClass: FALLBACK_PILL,
    }
  );
}

export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return 'never';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'never';
  const diffSec = Math.round((Date.now() - then) / 1000);
  if (diffSec < 60) return 'just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 2_592_000) return `${Math.floor(diffSec / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}
