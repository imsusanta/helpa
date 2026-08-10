import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { hasMinRole, type AccountRole } from './roles';
import { APPWRITE_CONFIG } from '@/infrastructure/appwrite/config';
import { accountsRepository } from '@/infrastructure/appwrite/repositories/accounts.repository';
import { profilesRepository } from '@/infrastructure/appwrite/repositories/profiles.repository';

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
  /** Appwrite data adapter used by routes being migrated to repositories. */
  appwrite?: import('@/lib/appwrite-compat').AppwriteCompatClient;
}

export async function getCurrentAccount(): Promise<AccountContext> {
  try {
    const cookieStore = await cookies();
    const session =
      cookieStore.get(`a_session_${APPWRITE_CONFIG.projectId}`)?.value ||
      cookieStore.get('appwrite_session')?.value;
    if (!session) throw new UnauthorizedError();

    const response = await fetch(`${APPWRITE_CONFIG.endpoint}/account`, {
      headers: {
        'X-Appwrite-Project': APPWRITE_CONFIG.projectId,
        'X-Appwrite-Session': session,
      },
      cache: 'no-store',
    });
    if (!response.ok) throw new UnauthorizedError();
    const appwriteUser = await response.json();

    const profile = await profilesRepository.getProfileByUserId(
      appwriteUser.$id
    );
    if (!profile || !profile.accountId || !profile.role) {
      throw new ForbiddenError('Account profile missing or unauthorized');
    }

    const accountId = profile.accountId;
    const accountDoc = await accountsRepository.getAccount(accountId);

    return {
      userId: appwriteUser.$id,
      accountId,
      role: profile.role,
      account: { id: accountId, name: accountDoc?.name || 'Clinic Account' },
    };
  } catch (error) {
    if (error instanceof UnauthorizedError) throw error;
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
