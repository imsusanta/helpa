import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { hasMinRole, type AccountRole } from './roles';
import { APPWRITE_CONFIG } from '@/infrastructure/appwrite/config';
import { accountsRepository } from '@/infrastructure/appwrite/repositories/accounts.repository';
import { profilesRepository } from '@/infrastructure/appwrite/repositories/profiles.repository';
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
  /** Appwrite / data adapter used by routes being migrated to repositories. */
  appwrite?: import('@/lib/appwrite-compat').AppwriteCompatClient;
}

export async function getCurrentAccount(): Promise<AccountContext> {
  try {
    // 1. Try Supabase Auth first
    if (
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ) {
      try {
        const supabase = await createSupabaseServerClient();
        const {
          data: { user: sbUser },
        } = await supabase.auth.getUser();

        if (sbUser) {
          const admin = getSupabaseAdminClient();
          const { data: member } = await admin
            .from('account_members')
            .select('account_id, role, accounts:account_id(id, name)')
            .eq('user_id', sbUser.id)
            .maybeSingle();

          const accountId = member?.account_id || sbUser.id;
          const role = (member?.role as AccountRole) || 'owner';
          const accountName =
            (member?.accounts as { name?: string })?.name ||
            sbUser.user_metadata?.full_name ||
            'Clinic Account';

          return {
            userId: sbUser.id,
            accountId,
            role,
            email: sbUser.email || '',
            account: { id: accountId, name: accountName },
            appwrite: appwriteAdmin(),
          };
        }
      } catch {
        // Fallback to Appwrite auth
      }
    }

    // 2. Fallback to Appwrite Auth
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();
    const session =
      allCookies.find((c) => c.name.startsWith('a_session_'))?.value ||
      cookieStore.get(`a_session_${APPWRITE_CONFIG.projectId}`)?.value;
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

    let profile = await profilesRepository.getProfileByUserId(appwriteUser.$id);

    if (!profile || !profile.accountId || !profile.role) {
      const defaultAccountId =
        appwriteUser.prefs?.accountId ||
        appwriteUser.prefs?.account_id ||
        `acc_${appwriteUser.$id}`;

      try {
        profile = await profilesRepository.createProfile({
          userId: appwriteUser.$id,
          accountId: defaultAccountId,
          name: appwriteUser.name || appwriteUser.email || 'User',
          email: appwriteUser.email || '',
          role: 'owner',
        });
      } catch {
        profile = {
          $id: appwriteUser.$id,
          userId: appwriteUser.$id,
          accountId: defaultAccountId,
          name: appwriteUser.name || 'User',
          email: appwriteUser.email || '',
          role: 'owner',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }
    }

    const accountId = profile.accountId;
    const accountDoc = await accountsRepository.getAccount(accountId);

    return {
      userId: appwriteUser.$id,
      accountId,
      role: profile.role,
      email: appwriteUser.email || profile.email || '',
      account: { id: accountId, name: accountDoc?.name || 'Clinic Account' },
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
