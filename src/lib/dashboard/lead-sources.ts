export type LeadSourceRow = {
  source?: string | null;
  channel?: string | null;
};

export type LeadSourceSlice = {
  key: string;
  label: string;
  count: number;
  percent: number;
};

const SOURCE_ALIASES: Record<string, string> = {
  whatsapp: 'whatsapp',
  whatsapp_ai: 'whatsapp',
  wa: 'whatsapp',
  facebook: 'facebook',
  fb: 'facebook',
  meta: 'facebook',
  instagram: 'instagram',
  import: 'import',
  csv: 'import',
  website: 'website_form',
  website_form: 'website_form',
  campaign: 'campaign',
  lead_conversion: 'lead_conversion',
  calendly: 'calendly',
  calendly_ai: 'calendly',
};

const SOURCE_LABELS: Record<string, string> = {
  whatsapp: 'WhatsApp',
  facebook: 'Facebook',
  instagram: 'Instagram',
  import: 'Import',
  website_form: 'Website',
  campaign: 'Campaign',
  lead_conversion: 'Conversion',
  calendly: 'Calendly',
};

function titleCase(value: string) {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function normalizeLeadSourceKey(value: string | null | undefined) {
  const raw = String(value || '')
    .trim()
    .toLowerCase();
  if (!raw) return '';
  return SOURCE_ALIASES[raw] || raw;
}

export function leadSourceLabel(key: string) {
  return SOURCE_LABELS[key] || titleCase(key);
}

/**
 * Groups tenant leads by the existing `source` column (falls back to
 * `channel`) and returns the top slices with percentages of the full set.
 */
export function aggregateLeadSources(
  rows: LeadSourceRow[],
  limit = 3
): LeadSourceSlice[] {
  const counts = new Map<string, number>();

  for (const row of rows) {
    const key = normalizeLeadSourceKey(row.source || row.channel);
    if (!key) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
  if (total === 0) return [];

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([key, count]) => ({
      key,
      label: leadSourceLabel(key),
      count,
      percent: Math.round((count / total) * 100),
    }));
}
