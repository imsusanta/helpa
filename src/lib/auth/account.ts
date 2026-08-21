import { NextResponse } from 'next/server';
import { hasMinRole, isAccountRole, type AccountRole } from './roles';
import { appwriteAdmin } from '@/lib/appwrite-server-compat';
import {
  createClient as createSupabaseServerClient,
  getAdminClient as getSupabaseAdminClient,
} from '@/lib/supabase/server';

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
  /** Supabase data adapter retained under the historical property name. */
  appwrite?: import('@/lib/appwrite-server-compat').AppwriteCompatClient;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getCurrentAccount(): Promise<any> {
  try {
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

          await admin.from('account_members').upsert(
            {
              account_id: accountId,
              user_id: userId,
              role,
              active: true,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'account_id, user_id' }
          );
        }
      }
    }

    if (!accountId) {
      throw new ForbiddenError('Account membership is required');
    }

    if (!isAccountRole(role)) {
      throw new ForbiddenError('Invalid account role');
    }

    const { data: accountDoc } = await admin
      .from('accounts')
      .select('id, name')
      .eq('id', accountId)
      .maybeSingle();

    if (!accountDoc) {
      throw new ForbiddenError('Account not found');
    }

    return {
      userId,
      accountId,
      role,
      email: user.email || undefined,
      account: {
        id: accountId,
        name: accountDoc.name || 'Clinic Account',
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function requireRole(min: AccountRole): Promise<any> {
  const ctx = await getCurrentAccount();
  if (!hasMinRole(ctx.role, min)) {
    throw new ForbiddenError(
      `This action requires the '${min}' role or higher`
    );
  }
  return ctx;
}
