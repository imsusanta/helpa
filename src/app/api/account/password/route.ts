import { NextResponse } from 'next/server';
import { getCurrentAccount, toErrorResponse } from '@/lib/auth/account';
import { getAppwriteAdminClient } from '@/infrastructure/appwrite/server';

export async function POST(request: Request) {
  try {
    const ctx = await getCurrentAccount();
    if (!ctx.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as {
      currentPassword?: string;
      newPassword?: string;
    } | null;

    const newPassword = body?.newPassword;
    if (
      !newPassword ||
      typeof newPassword !== 'string' ||
      newPassword.length < 8
    ) {
      return NextResponse.json(
        { error: 'New password must be at least 8 characters long' },
        { status: 400 }
      );
    }

    const admin = getAppwriteAdminClient();
    await admin.users.updatePassword(ctx.userId, newPassword);

    return NextResponse.json({
      success: true,
      message: 'Password updated successfully!',
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
