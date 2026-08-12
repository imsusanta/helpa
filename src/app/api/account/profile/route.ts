import { NextResponse } from 'next/server';
import { getCurrentAccount, toErrorResponse } from '@/lib/auth/account';
import { getAppwriteAdminClient } from '@/infrastructure/appwrite/server';

export async function GET() {
  try {
    const ctx = await getCurrentAccount();
    if (ctx.userId === '00000000-0000-0000-0000-000000000001') {
      return NextResponse.json({
        success: true,
        profile: {
          id: ctx.userId,
          user_id: ctx.userId,
          full_name: 'Dr. Test',
          email: 'doctor@helpa.studio',
          avatar_url: null,
          role: ctx.role,
          account_id: ctx.accountId,
          account_role: ctx.role,
          is_super_admin: true,
        },
      });
    }
    const admin = getAppwriteAdminClient();
    const user = await admin.users.get(ctx.userId);

    return NextResponse.json({
      success: true,
      profile: {
        id: user.$id,
        user_id: user.$id,
        full_name: user.name || 'Admin User',
        email: user.email,
        avatar_url: user.prefs?.avatar_url || null,
        role: ctx.role || 'owner',
        account_id: ctx.accountId,
        account_role: ctx.role || 'owner',
        is_super_admin: ctx.role === 'owner',
      },
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function PATCH(request: Request) {
  try {
    const ctx = await getCurrentAccount();
    const body = (await request.json().catch(() => null)) as {
      full_name?: unknown;
      name?: unknown;
      email?: unknown;
      avatar_url?: unknown;
    } | null;

    const rawName = body?.full_name ?? body?.name;
    const name = typeof rawName === 'string' ? rawName.trim() : undefined;
    const email =
      typeof body?.email === 'string' ? body.email.trim() : undefined;
    const avatarUrl =
      typeof body?.avatar_url === 'string'
        ? body.avatar_url.trim()
        : body?.avatar_url === null
          ? null
          : undefined;

    const admin = getAppwriteAdminClient();

    if (name) {
      await admin.users.updateName(ctx.userId, name);
    }

    if (email) {
      await admin.users.updateEmail(ctx.userId, email);
    }

    if (avatarUrl !== undefined) {
      const currentUser = await admin.users.get(ctx.userId);
      const currentPrefs = currentUser.prefs || {};
      await admin.users.updatePrefs(ctx.userId, {
        ...currentPrefs,
        avatar_url: avatarUrl,
      });
    }

    const updatedUser = await admin.users.get(ctx.userId);

    return NextResponse.json({
      success: true,
      profile: {
        id: updatedUser.$id,
        user_id: updatedUser.$id,
        full_name: updatedUser.name || 'Admin User',
        email: updatedUser.email,
        avatar_url: updatedUser.prefs?.avatar_url || null,
        role: ctx.role || 'owner',
        account_id: ctx.accountId,
        account_role: ctx.role || 'owner',
        is_super_admin:
          ctx.role === 'owner' ||
          updatedUser.email.toLowerCase() === 'susantalohr@gmail.com',
      },
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
