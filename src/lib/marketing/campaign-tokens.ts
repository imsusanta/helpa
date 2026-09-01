/**
 * Marketing — campaign message token substitution.
 *
 * The immediate-send path (src/core/campaigns) replaced only
 * `{{Name}}` / `{{PatientName}}`, while the scheduled-send cron replaced
 * `{{PatientName}}` / `{{HospitalName}}`. Any other industry's token
 * therefore shipped to the customer verbatim — e.g. a travel workspace
 * campaign reading "Hi {{Name}}" was delivered literally.
 *
 * One vocabulary, industry-agnostic: every person-name alias resolves to
 * the contact name, every business alias to the workspace name.
 */

/** Tokens that resolve to the recipient's name. */
export const PERSON_NAME_TOKENS = [
  'Name',
  'PatientName',
  'StudentName',
  'CustomerName',
  'ClientName',
  'GuestName',
  'TravellerName',
  'TravelerName',
  'MemberName',
  'ContactName',
] as const;

/** Tokens that resolve to the workspace / business name. */
export const BUSINESS_NAME_TOKENS = [
  'HospitalName',
  'BusinessName',
  'CompanyName',
  'ClinicName',
  'WorkspaceName',
  'AgencyName',
] as const;

export interface CampaignTokenContext {
  /** Recipient name; blank/missing falls back to `fallbackName`. */
  contactName?: string | null;
  /** Workspace/account name. */
  businessName?: string | null;
  /** Used when the contact has no name on record. */
  fallbackName?: string;
}

function tokenPattern(tokens: readonly string[]): RegExp {
  // Tolerate optional inner whitespace: {{ Name }} behaves like {{Name}}.
  return new RegExp(`\\{\\{\\s*(?:${tokens.join('|')})\\s*\\}\\}`, 'g');
}

const PERSON_PATTERN = tokenPattern(PERSON_NAME_TOKENS);
const BUSINESS_PATTERN = tokenPattern(BUSINESS_NAME_TOKENS);

/**
 * Substitutes person/business tokens in a campaign body. Unknown tokens
 * are left untouched so genuinely dynamic placeholders (dates, links)
 * remain visible rather than being silently blanked.
 */
export function applyCampaignTokens(
  body: string | null | undefined,
  context: CampaignTokenContext
): string {
  if (!body) return '';
  const name = context.contactName?.trim() || context.fallbackName || 'there';
  const business = context.businessName?.trim() || '';

  return body.replace(PERSON_PATTERN, name).replace(BUSINESS_PATTERN, business);
}
