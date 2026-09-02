import type { CopilotContact } from '@/lib/ai/receptionist-copilot';

/**
 * Columns that actually exist on `public.contacts`.
 * Selecting `company` 42703s in production (`column contacts_1.company does not exist`)
 * and the copilot panel shows "Failed to load conversation".
 */
export const COPILOT_CONTACT_SELECT =
  'id, name, phone, email, metadata' as const;

export const COPILOT_CONVERSATION_SELECT =
  `id, account_id, contact_id, status, last_message_text, last_message_at, ai_summary, created_at, contact:contacts(${COPILOT_CONTACT_SELECT})` as const;

function companyFromMetadata(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return null;
  }
  const company = (metadata as Record<string, unknown>).company;
  return typeof company === 'string' && company.trim().length > 0
    ? company
    : null;
}

export function toCopilotContact(
  row:
    | {
        id?: unknown;
        name?: unknown;
        phone?: unknown;
        email?: unknown;
        metadata?: unknown;
      }
    | null
    | undefined
): CopilotContact | null {
  if (!row || typeof row.id !== 'string') return null;
  return {
    id: row.id,
    name: typeof row.name === 'string' ? row.name : null,
    phone: typeof row.phone === 'string' ? row.phone : null,
    email: typeof row.email === 'string' ? row.email : null,
    company: companyFromMetadata(row.metadata),
  };
}
