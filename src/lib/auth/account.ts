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
    const { data: claims, error: claimsError } =
      await supabase.auth.getClaims();
    const userId = claims?.claims?.sub;
    if (claimsError || !userId || typeof userId !== 'string') {
      throw new UnauthorizedError();
    }
    const admin = getSupabaseAdminClient();
    const { data: member, error: memberError } = await admin
      .from('account_members')
      .select('account_id, role, accounts:account_id(id, name)')
      .eq('user_id', userId)
      .eq('active', true)
      .maybeSingle();
    if (memberError || !member?.account_id || !member.role) {
      throw new ForbiddenError('Account membership is required');
    }
    const account = member.accounts as unknown as {
      id: string;
      name: string;
    } | null;
    return {
      userId,
      accountId: member.account_id,
      role: member.role as AccountRole,
      email:
        typeof claims.claims.email === 'string'
          ? claims.claims.email
          : undefined,
      account: {
        id: member.account_id,
        name: account?.name || 'Clinic Account',
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
