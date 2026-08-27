import crypto from 'node:crypto';
import { getAdminClient } from '@/lib/supabase/server';

export interface GenerateOAuthStateOptions {
  accountId: string;
  userId: string;
  provider?: string;
  expiresInSeconds?: number;
}

export interface OAuthStateResult {
  state: string;
  expiresAt: string;
}

/**
 * Generates a cryptographically secure OAuth state, stores it in Supabase,
 * and binds it strictly to the tenant (accountId) and user (userId).
 *
 * The database-backed state is intentionally required. A stateless signed
 * fallback cannot be consumed atomically and can therefore be replayed until
 * it expires. If the oauth_states table is unavailable, onboarding fails
 * closed and the operator must apply the migration or refresh PostgREST's
 * schema cache.
 */
export async function generateOAuthState({
  accountId,
  userId,
  provider = 'meta_whatsapp',
  expiresInSeconds = 900, // 15 minutes
}: GenerateOAuthStateOptions): Promise<OAuthStateResult> {
  if (!accountId || !userId) {
    throw new Error(
      'accountId and userId are required to generate OAuth state'
    );
  }

  const expiresAt = new Date(
    Date.now() + expiresInSeconds * 1000
  ).toISOString();
  const rawState = crypto.randomBytes(32).toString('hex');
  const supabase = getAdminClient();
  const { error } = await supabase.from('oauth_states').insert({
    account_id: accountId,
    user_id: userId,
    provider,
    state: rawState,
    expires_at: expiresAt,
  });

  if (error) {
    const isMissingTable =
      error.message?.includes('oauth_states') ||
      error.message?.includes('schema cache') ||
      error.code === 'PGRST205' ||
      error.code === '42P01';

    if (isMissingTable) {
      throw new Error(
        'OAuth state storage is unavailable. Apply the oauth_states migration and refresh the Supabase schema cache before connecting WhatsApp.'
      );
    }

    throw new Error(`Failed to persist OAuth state: ${error.message}`);
  }

  return { state: rawState, expiresAt };
}

export interface ValidateOAuthStateOptions {
  state: string;
  accountId: string;
  userId: string;
  provider?: string;
}

export interface ValidatedOAuthState {
  id: string;
  accountId: string;
  userId: string;
  state: string;
  createdAt: string;
}

/**
 * Validates that an incoming OAuth state exists, is bound to the given tenant
 * and user, is not expired, and has not been used yet. The state is claimed
 * with a conditional UPDATE so concurrent replay attempts cannot both win.
 */
export async function validateAndConsumeOAuthState({
  state,
  accountId,
  userId,
  provider = 'meta_whatsapp',
}: ValidateOAuthStateOptions): Promise<ValidatedOAuthState> {
  if (!state || typeof state !== 'string' || !state.trim()) {
    throw new Error('OAuth state parameter is missing or invalid');
  }

  const cleanState = state.trim();
  const supabase = getAdminClient();

  const { data: row, error } = await supabase
    .from('oauth_states')
    .select(
      'id, account_id, user_id, provider, state, expires_at, used_at, created_at'
    )
    .eq('state', cleanState)
    .eq('provider', provider)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Invalid or unknown OAuth state parameter: ${error.message}`
    );
  }

  if (!row) {
    throw new Error('Invalid or unknown OAuth state parameter');
  }

  if (row.used_at) {
    throw new Error(
      'OAuth state has already been consumed (replay attack prevented)'
    );
  }

  const now = new Date();
  const expiresAt = new Date(row.expires_at);
  if (now > expiresAt) {
    throw new Error('OAuth state has expired. Please try connecting again.');
  }

  if (row.account_id !== accountId) {
    throw new Error('OAuth state tenant mismatch (unauthorized workspace)');
  }

  if (row.user_id !== userId) {
    throw new Error('OAuth state user mismatch (unauthorized user)');
  }

  const { data: claimedRows, error: updateError } = await supabase
    .from('oauth_states')
    .update({ used_at: now.toISOString() })
    .eq('id', row.id)
    .is('used_at', null)
    .select('id');

  if (updateError) {
    throw new Error('Failed to consume OAuth state');
  }

  if (!claimedRows || claimedRows.length !== 1) {
    throw new Error(
      'OAuth state has already been consumed (replay attack prevented)'
    );
  }

  return {
    id: row.id,
    accountId: row.account_id,
    userId: row.user_id,
    state: row.state,
    createdAt: row.created_at,
  };
}
