import { NextResponse } from 'next/server';
import { hasMinRole, isAccountRole, type AccountRole } from './roles';
import { getAdminClient, type AdminClient } from '@/lib/db/server';
import {
  createClient as createSupabaseServerClient,
  getAdminClient as getSupabaseAdminClient,
} from '@/lib/supabase/server';
import { getRuntimeConfig } from '@/lib/runtime-config';
import {
  resolveIndustryAlias,
  type CanonicalIndustry,
} from '@/core/modules/terminology';

export class UnauthorizedError extends Error {
  readonly status = 401 as const;
  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends Error {
  readonly status = 403 as const;
  constructor(message = 'Forbidden') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

const CACHE_HEADERS = {
  'Cache-Control': 'private, no-store, no-cache, must-revalidate',
} as const;

export function toErrorResponse(err: unknown): NextResponse {
  if (err instanceof UnauthorizedError || err instanceof ForbiddenError) {
    return NextResponse.json(
      { error: err.message },
      { status: err.status, headers: CACHE_HEADERS }
    );
  }
  console.error('[toErrorResponse] uncategorized error:', err);
  return NextResponse.json(
    { error: 'Internal server error' },
    { status: 500, headers: CACHE_HEADERS }
  );
}

export interface AccountContext {
  userId: string;
  accountId: string;
  role: AccountRole;
  email?: string;
  /**
   * Canonical, server-resolved workspace industry. Always derived from the
   * authenticated account row — never from a client-supplied value. Use this
   * for any industry-scoped decision instead of trusting request input.
   */
  industry: CanonicalIndustry;
  account: { id: string; name: string; industry: string };
  /** Service-role database client for this request. Always set. */
  admin: AdminClient;
  /** @deprecated Use `admin`. Alias kept for remaining ctx.appwrite call sites. */
  appwrite: AdminClient;
}

// The compatibility client is typed as any during the incremental migration,
// so optional access remains backward-compatible while runtime callers always
// receive the Supabase-backed value returned below.
export type ResolvedAccountContext = AccountContext;

export async function getCurrentAccount(): Promise<ResolvedAccountContext> {
  try {
    const runtime = getRuntimeConfig();
    if (runtime.authProvider !== 'supabase') {
      throw new UnauthorizedError('Canonical authentication is unavailable');
    }

    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    const userId = user?.id;
    if (userError || !userId || typeof userId !== 'string') {
      throw new UnauthorizedError();
    }

    const admin = getSupabaseAdminClient();
    const { data: memberships } = await admin
      .from('account_members')
      .select('account_id, role, active')
      .eq('user_id', userId)
      .eq('active', true);

    let accountId: string | null = null;
    let role: AccountRole = 'viewer';

    if (memberships && memberships.length > 0) {
      const activeMember = memberships[0];
      accountId = activeMember.account_id;
      role = (activeMember.role as AccountRole) || 'viewer';
    } else {
      const { data: profile } = await admin
        .from('profiles')
        .select('id, account_id, role, account_role')
        .eq('user_id', userId)
        .maybeSingle();

      if (profile?.account_id) {
        const { data: targetAccount } = await admin
          .from('accounts')
          .select('id, name')
          .eq('id', profile.account_id)
          .maybeSingle();
        if (targetAccount) {
          accountId = targetAccount.id;
          role =
            (profile.account_role as AccountRole) ||
            (profile.role as AccountRole) ||
            'viewer';
          await admin.from('profiles').upsert(
            {
              user_id: userId,
              account_id: accountId,
              role,
              account_role: role,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id' }
          );
        }
      }
    }

    if (!accountId) {
      const { data: ownedAccount } = await admin
        .from('accounts')
        .select('id, name')
        .eq('owner_user_id', userId)
        .maybeSingle();
      if (ownedAccount) {
        accountId = ownedAccount.id;
        role = 'owner';
        await admin.from('profiles').upsert(
          {
            user_id: userId,
            account_id: accountId,
            email: user.email || '',
            full_name:
              user.user_metadata?.full_name ||
              user.email?.split('@')[0] ||
              'User',
            role: 'owner',
            account_role: 'owner',
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );
      }
    }

    if (!accountId) {
      const defaultName =
        user.user_metadata?.business_name ||
        user.user_metadata?.full_name ||
        (user.email
          ? `${user.email.split('@')[0]}'s Workspace`
          : 'My Workspace');
      const { data: newAccount } = await admin
        .from('accounts')
        .insert({
          name: defaultName,
          owner_user_id: userId,
          industry: user.user_metadata?.industry || 'health',
        })
        .select('id, name')
        .maybeSingle();
      if (newAccount) {
        accountId = newAccount.id;
        role = 'owner';
        await admin.from('profiles').upsert(
          {
            user_id: userId,
            account_id: accountId,
            email: user.email || '',
            full_name:
              user.user_metadata?.full_name ||
              user.email?.split('@')[0] ||
              'User',
            role: 'owner',
            account_role: 'owner',
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );
      }
    }

    if (!accountId) throw new ForbiddenError('Account membership is required');
    if (!isAccountRole(role)) throw new ForbiddenError('Invalid account role');

    const { data: accountDoc } = await admin
      .from('accounts')
      .select('id, name, industry')
      .eq('id', accountId)
      .maybeSingle();
    if (!accountDoc) throw new ForbiddenError('Account not found');

    const rawIndustry = (accountDoc as { industry?: string | null }).industry;
    const industry = resolveIndustryAlias(rawIndustry);

    return {
      userId,
      accountId,
      role,
      email: user.email || undefined,
      industry,
      account: {
        id: accountId,
        name: accountDoc.name || 'Clinic Account',
        industry: rawIndustry || 'general',
      },
      admin: getAdminClient(),
      appwrite: getAdminClient(),
    };
  } catch (error) {
    if (error instanceof UnauthorizedError || error instanceof ForbiddenError) {
      throw error;
    }
    throw new UnauthorizedError();
  }
}

export async function requireRole(
  min: AccountRole
): Promise<ResolvedAccountContext> {
  const ctx = await getCurrentAccount();
  if (!hasMinRole(ctx.role, min)) {
    throw new ForbiddenError(
      `This action requires the '${min}' role or higher`
    );
  }
  return ctx;
}
