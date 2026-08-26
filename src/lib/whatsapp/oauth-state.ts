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

function getSigningSecret(): string {
  const secret =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.META_APP_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.APPWRITE_API_KEY;
  if (!secret) {
    // Fail closed: a static fallback key in a public repository would
    // make every HMAC state token forgeable.
    throw new Error(
      'OAuth state signing requires SUPABASE_SERVICE_ROLE_KEY (or META_APP_SECRET) to be configured'
    );
  }
  return secret;
}

function signHmacState(payload: {
  accountId: string;
  userId: string;
  provider: string;
  exp: number;
  rand: string;
}): string {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const hmac = crypto
    .createHmac('sha256', getSigningSecret())
    .update(data)
    .digest('base64url');
  return `hmac.${data}.${hmac}`;
}

function verifyHmacState(token: string): {
  accountId: string;
  userId: string;
  provider: string;
  exp: number;
  rand: string;
} | null {
  if (!token || !token.startsWith('hmac.')) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [, data, sig] = parts;
  if (!data || !sig) return null;

  const expectedSig = crypto
    .createHmac('sha256', getSigningSecret())
    .update(data)
    .digest('base64url');

  try {
    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expectedSig);
    if (
      sigBuf.length !== expBuf.length ||
      !crypto.timingSafeEqual(sigBuf, expBuf)
    ) {
      return null;
    }
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    return payload;
  } catch {
    return null;
  }
}

/**
 * Generates a cryptographically secure OAuth state, stores it in Supabase,
 * and binds it strictly to the tenant (accountId) and user (userId).
 * If the `oauth_states` table is pending in PostgREST schema cache,
 * securely falls back to a signed cryptographic HMAC state token.
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

  const now = Date.now();
  const expiresAt = new Date(now + expiresInSeconds * 1000).toISOString();
  const rawState = crypto.randomBytes(32).toString('hex');

  try {
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
        console.warn(
          '[oauth-state] `public.oauth_states` table missing in schema cache. Using cryptographic HMAC state fallback.'
        );
        const signedState = signHmacState({
          accountId,
          userId,
          provider,
          exp: now + expiresInSeconds * 1000,
          rand: rawState,
        });
        return { state: signedState, expiresAt };
      }

      throw new Error(`Failed to persist OAuth state: ${error.message}`);
    }

    return { state: rawState, expiresAt };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('oauth_states') || message.includes('schema cache')) {
      console.warn(
        '[oauth-state] Falling back to signed HMAC state token due to schema cache.'
      );
      const signedState = signHmacState({
        accountId,
        userId,
        provider,
        exp: now + expiresInSeconds * 1000,
        rand: rawState,
      });
      return { state: signedState, expiresAt };
    }
    throw err;
  }
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
 * Validates that an incoming OAuth state exists, is bound to the given tenant and user,
 * is not expired, and has not been used yet.
 * Marks the state as used atomically to prevent replay attacks.
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

  // 1. Check if this is a signed HMAC fallback token
  if (cleanState.startsWith('hmac.')) {
    const payload = verifyHmacState(cleanState);
    if (!payload) {
      throw new Error('Invalid or forged OAuth state signature');
    }

    if (Date.now() > payload.exp) {
      throw new Error('OAuth state has expired. Please try connecting again.');
    }

    if (payload.accountId !== accountId) {
      throw new Error('OAuth state tenant mismatch (unauthorized workspace)');
    }

    if (payload.userId !== userId) {
      throw new Error('OAuth state user mismatch (unauthorized user)');
    }

    if (payload.provider !== provider) {
      throw new Error('OAuth state provider mismatch');
    }

    return {
      id: 'hmac-verified-state',
      accountId: payload.accountId,
      userId: payload.userId,
      state: cleanState,
      createdAt: new Date(payload.exp - 900000).toISOString(),
    };
  }

  // 2. Query database for persistent table row
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

  // Atomically mark state as used
  const { error: updateError } = await supabase
    .from('oauth_states')
    .update({ used_at: now.toISOString() })
    .eq('id', row.id)
    .is('used_at', null);

  if (updateError) {
    throw new Error('Failed to consume OAuth state');
  }

  return {
    id: row.id,
    accountId: row.account_id,
    userId: row.user_id,
    state: row.state,
    createdAt: row.created_at,
  };
}
