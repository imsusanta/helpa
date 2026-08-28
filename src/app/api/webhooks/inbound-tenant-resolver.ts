import { getAdminClient } from '@/lib/supabase/server';
import { normalizePhone } from '@/lib/whatsapp/phone-utils';
import { extractValidAccountId } from '@/core/providers/whatsapp/waha-provider';
import { webhookSecretMatches } from '@/core/providers/whatsapp/evolution-go-provider';

type Row = Record<string, unknown>;

export interface ResolvedInboundTenant {
  accountId: string;
  userId: string;
}

function isMissingRelation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: string; message?: string };
  return (
    candidate.code === '42P01' ||
    candidate.code === 'PGRST205' ||
    /relation .* does not exist|could not find the table/i.test(
      candidate.message || ''
    )
  );
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function rowValue(row: Row, ...keys: string[]): string {
  for (const key of keys) {
    const candidate = stringValue(row[key]);
    if (candidate) return candidate;
  }
  return '';
}

function objectValue(value: unknown): Row {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Row)
    : {};
}

function configurationValues(configuration: unknown): string[] {
  // Only routing fields are eligible. Do not scan encrypted credentials or
  // arbitrary metadata for digit strings that happen to match a phone.
  const config = objectValue(configuration);
  const allowedKeys = new Set([
    'phone',
    'phone_number',
    'phoneNumber',
    'display_phone_number',
    'displayPhoneNumber',
    'from',
    'from_phone',
    'fromPhone',
    'to',
    'to_phone',
    'toPhone',
    'recipient',
    'recipient_phone',
    'recipientPhone',
    'session',
    'session_name',
    'sessionName',
    'phone_number_id',
    'phoneNumberId',
    'account_sid',
    'accountSid',
    'messaging_service_sid',
    'messagingServiceSid',
  ]);
  return Object.entries(config)
    .filter(([key]) => allowedKeys.has(key))
    .flatMap(([, value]) => {
      if (Array.isArray(value)) return value.map((item) => String(item).trim());
      return [String(value ?? '').trim()];
    })
    .filter(Boolean);
}

function exactPhoneMatch(left: string, right: string): boolean {
  const a = normalizePhone(left);
  const b = normalizePhone(right);
  return Boolean(a && b && a === b);
}

async function resolveUserId(accountId: string): Promise<string> {
  const db = getAdminClient();
  try {
    const account = await db
      .from('accounts')
      .select('owner_user_id')
      .eq('id', accountId)
      .maybeSingle();
    if (account.error) throw account.error;
    if (account.data?.owner_user_id) return String(account.data.owner_user_id);
  } catch {
    // Some canonical/legacy account shapes omit owner_user_id.
  }

  try {
    const members = await db
      .from('account_members')
      .select('user_id, role, active')
      .eq('account_id', accountId)
      .eq('active', true);
    if (!members.error && members.data?.length) {
      const preferred = members.data.find(
        (member: Row) => member.role === 'owner'
      );
      return String((preferred || members.data[0]).user_id || '');
    }
  } catch {
    // user_id is optional on the modern contact/conversation schema.
  }
  return '';
}

async function assertAccountExists(accountId: string): Promise<boolean> {
  const result = await getAdminClient()
    .from('accounts')
    .select('id')
    .eq('id', accountId)
    .limit(1);
  if (result.error) throw result.error;
  return Boolean(result.data?.length);
}

async function loadIntegrations(provider: 'waha' | 'twilio'): Promise<Row[]> {
  const result = await getAdminClient()
    .from('clinic_integrations')
    .select('*')
    .eq('provider', provider);
  if (result.error) {
    if (isMissingRelation(result.error)) return [];
    throw result.error;
  }
  return ((result.data || []) as Row[]).filter((row) =>
    ['active', 'configured'].includes(String(row.status || 'active'))
  );
}

function uniqueAccount(rows: Row[]): string | null {
  const ids = [
    ...new Set(rows.map((row) => stringValue(row.account_id)).filter(Boolean)),
  ];
  return ids.length === 1 ? ids[0] : null;
}

/** Resolve a WAHA webhook to exactly one server-side configuration. */
export async function resolveWahaTenant(
  payload: Record<string, unknown>
): Promise<ResolvedInboundTenant | null> {
  const claimedAccountId = extractValidAccountId(payload);
  const data = objectValue(payload.payload);
  const recipient = stringValue(
    data.to || data.recipient || data.recipientPhone || payload.to
  ).replace(/@(?:c|s)\.us$/i, '');
  const session = stringValue(
    payload.session ||
      data.session ||
      data.sessionName ||
      payload.phone_number_id
  );

  const integrations = await loadIntegrations('waha');
  const integrationMatches = integrations.filter((row) => {
    if (claimedAccountId && row.account_id !== claimedAccountId) return false;
    const values = [
      ...configurationValues(row.configuration),
      rowValue(row, 'phone_number', 'display_phone_number', 'phoneNumber'),
      rowValue(row, 'phone_number_id', 'phoneNumberId'),
    ].filter(Boolean);
    if (recipient && values.some((item) => exactPhoneMatch(item, recipient))) {
      return true;
    }
    if (session && values.includes(session)) return true;
    // A claim is usable only after the server verifies that this account has
    // an active WAHA integration; the body value is never accepted alone.
    return Boolean(claimedAccountId && !recipient && !session);
  });
  let accountId = uniqueAccount(integrationMatches);

  if (!accountId) {
    let query = getAdminClient()
      .from('whatsapp_configs')
      .select(
        'account_id, phone_number_id, phone_number, display_phone_number, provider, connection_type, status'
      );
    if (claimedAccountId) query = query.eq('account_id', claimedAccountId);
    const result = await query;
    if (result.error) throw result.error;
    const matches = ((result.data || []) as Row[]).filter((row) => {
      const configuredPhone = stringValue(
        row.display_phone_number || row.phone_number
      );
      const configuredSession = stringValue(row.phone_number_id);
      if (recipient) return exactPhoneMatch(configuredPhone, recipient);
      if (session) return configuredSession === session;
      return Boolean(claimedAccountId);
    });
    accountId = uniqueAccount(matches);
  }

  if (!accountId || !(await assertAccountExists(accountId))) return null;
  return { accountId, userId: await resolveUserId(accountId) };
}

/** Resolve Twilio solely from the receiving number/provider configuration. */
export async function resolveTwilioTenant(
  payload: Record<string, unknown>
): Promise<ResolvedInboundTenant | null> {
  const isStatusCallback =
    !('Body' in payload) &&
    !('body' in payload) &&
    ('MessageStatus' in payload ||
      'message_status' in payload ||
      'Status' in payload);
  const recipient = stringValue(
    isStatusCallback
      ? (payload.From ?? payload.from)
      : (payload.To ?? payload.to)
  );
  const messagingServiceSid = stringValue(payload.MessagingServiceSid);
  const accountSid = stringValue(payload.AccountSid);
  if (!recipient && !messagingServiceSid) return null;

  const integrations = await loadIntegrations('twilio');
  const matches = integrations.filter((row) => {
    const values = [
      ...configurationValues(row.configuration),
      rowValue(
        row,
        'phone_number',
        'display_phone_number',
        'from_phone',
        'fromPhone'
      ),
    ].filter(Boolean);
    return (
      (recipient && values.some((item) => exactPhoneMatch(item, recipient))) ||
      (messagingServiceSid && values.includes(messagingServiceSid)) ||
      (accountSid &&
        recipient &&
        values.includes(accountSid) &&
        values.some((item) => exactPhoneMatch(item, recipient)))
    );
  });
  let accountId = uniqueAccount(matches);

  // Explicit single-workspace bootstrap. Unlike the former payload
  // account_id/default UUID, both the workspace and receiving number are
  // server-owned configuration and are verified before attribution.
  if (!accountId) {
    const envAccountId = stringValue(process.env.TWILIO_ACCOUNT_ID);
    const envPhone = stringValue(process.env.TWILIO_FROM_PHONE);
    const envSid = stringValue(process.env.TWILIO_ACCOUNT_SID);
    if (
      envAccountId &&
      recipient &&
      exactPhoneMatch(envPhone, recipient) &&
      (!accountSid || !envSid || accountSid === envSid)
    ) {
      accountId = envAccountId;
    }
  }

  if (!accountId || !(await assertAccountExists(accountId))) return null;
  return { accountId, userId: await resolveUserId(accountId) };
}

export interface ResolvedEvolutionTenant extends ResolvedInboundTenant {
  instanceId: string;
}

/**
 * Resolve an Evolution Go webhook from the URL secret + stored instance
 * mapping. Payload account_id / tenant_id values are ignored.
 */
export async function resolveEvolutionGoTenant(
  secret: string
): Promise<ResolvedEvolutionTenant | null> {
  const trimmed = stringValue(secret);
  if (!trimmed) return null;

  const result = await getAdminClient()
    .from('whatsapp_configs')
    .select('account_id, provider, provider_instance_id, webhook_secret_hash')
    .eq('provider', 'evolution');
  if (result.error) {
    if (isMissingRelation(result.error)) return null;
    throw result.error;
  }

  const matches = ((result.data || []) as Row[]).filter((row) =>
    webhookSecretMatches(trimmed, stringValue(row.webhook_secret_hash))
  );
  if (matches.length !== 1) return null;

  const accountId = stringValue(matches[0].account_id);
  const instanceId = stringValue(matches[0].provider_instance_id);
  if (!accountId || !instanceId) return null;
  if (!(await assertAccountExists(accountId))) return null;
  return {
    accountId,
    userId: await resolveUserId(accountId),
    instanceId,
  };
}
