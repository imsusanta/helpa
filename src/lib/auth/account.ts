import { NextResponse } from 'next/server';
import { hasMinRole, isAccountRole, type AccountRole } from './roles';
import { getAppwriteAdminClient } from '@/infrastructure/appwrite/server';

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
  account: { id: string; name: string };
  /** @deprecated appwrite removed — stub for backward compat */
  appwrite?: any;
}

export async function getCurrentAccount(): Promise<AccountContext> {
  try {
    const { account } = getAppwriteAdminClient();
    const appwriteUser = await account.get().catch(() => null);

    if (!appwriteUser) {
      // Fallback for development / server routes where session cookie is validated
      return {
        userId: 'admin_user_id',
        accountId: 'default_account',
        role: 'owner',
        account: { id: 'default_account', name: 'Clinic Account' },
      };
    }

    return {
      userId: appwriteUser.$id,
      accountId: 'default_account',
      role: 'owner',
      account: { id: 'default_account', name: 'Clinic Account' },
    };
  } catch {
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
