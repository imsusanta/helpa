import { NextResponse } from 'next/server';
import { hasMinRole, type AccountRole } from './roles';
import { appwriteAdmin } from '@/lib/appwrite-server-compat';
import {
  createClient as createSupabaseServerClient,
  getAdminClient as getSupabaseAdminClient,
} from '@/lib/supabase/server';
import { getRuntimeConfig } from '@/lib/runtime-config';

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
  account: { id: string; name: string };
  /** Appwrite / data adapter used by routes being migrated to repositories. */
  appwrite?: import('@/lib/appwrite-compat').AppwriteCompatClient;
}

export async function getCurrentAccount(): Promise<AccountContext> {
  try {
    const runtime = getRuntimeConfig();
    if (runtime.authProvider !== 'supabase') {
      if (runtime.migrationMode !== 'rollback') {
        throw new UnauthorizedError('Canonical authentication is unavailable');
      }
      throw new UnauthorizedError(
        'Appwrite rollback authentication is not enabled'
      );
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
    let { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('id, account_id, role, account_role, is_super_admin, email')
      .eq('user_id', userId)
      .maybeSingle();

    // Fallback: check profile by email if not found by user_id
    if (!profile && user.email) {
      const { data: byEmail } = await admin
        .from('profiles')
        .select('id, account_id, role, account_role, is_super_admin, email')
        .eq('email', user.email.toLowerCase())
        .maybeSingle();

      if (byEmail) {
        profile = byEmail;
        await admin
          .from('profiles')
          .update({ user_id: userId, updated_at: new Date().toISOString() })
          .eq('id', (byEmail as { id: string }).id);
      }
    }

    // If user has no account assigned yet, resolve or create one automatically
    let accountId = profile?.account_id;
    if (!accountId) {
      const { data: existingAccount } = await admin
        .from('accounts')
        .select('id, name')
        .limit(1)
        .maybeSingle();

      if (existingAccount) {
        accountId = existingAccount.id;
      } else {
        const { data: createdAccount } = await admin
          .from('accounts')
          .insert({
            name: user.user_metadata?.full_name || 'My Clinic',
            owner_user_id: userId,
          })
          .select('id, name')
          .single();
        accountId = createdAccount?.id;
      }

      if (accountId) {
        if (profile) {
          await admin
            .from('profiles')
            .update({
              account_id: accountId,
              account_role: 'owner',
              role: 'owner',
              is_super_admin: true,
              updated_at: new Date().toISOString(),
            })
            .eq('id', (profile as { id: string }).id);
        } else {
          const { data: createdProfile } = await admin
            .from('profiles')
            .insert({
              user_id: userId,
              email: user.email || '',
              full_name: user.user_metadata?.full_name || 'Clinic Admin',
              account_id: accountId,
              account_role: 'owner',
              role: 'owner',
              is_super_admin: true,
            })
            .select('id, account_id, role, account_role, is_super_admin, email')
            .single();
          profile = createdProfile;
        }
      }
    }

    if (!accountId) {
      throw new ForbiddenError('Account membership is required');
    }

    const { data: accountDoc } = await admin
      .from('accounts')
      .select('id, name')
      .eq('id', accountId)
      .maybeSingle();

    const effectiveRole: AccountRole = profile?.is_super_admin
      ? 'owner'
      : (profile?.account_role as AccountRole) ||
        (profile?.role as AccountRole) ||
        'owner';

    return {
      userId,
      accountId,
      role: effectiveRole,
      email: user.email || undefined,
      account: {
        id: accountId,
        name: accountDoc?.name || 'Clinic Account',
      },
      appwrite: appwriteAdmin(),
    };
  } catch (error) {
    if (error instanceof UnauthorizedError || error instanceof ForbiddenError) {
      throw error;
    }
    throw new UnauthorizedError();
  }
}

export async function requireRole(min: AccountRole): Promise<AccountContext> {
  const ctx = await getCurrentAccount();
  if (!hasMinRole(ctx.role, min)) {
    throw new ForbiddenError(
      `This action requires the '${min}' role or higher`
    );
  }
  return ctx;
}
