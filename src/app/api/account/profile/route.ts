import { NextResponse } from 'next/server';
import { getCurrentAccount, toErrorResponse } from '@/lib/auth/account';
import { getAdminClient as getSupabaseAdminClient } from '@/lib/supabase/server';

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

    const supabase = getSupabaseAdminClient();
    const { data: dbProfile, error: pErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', ctx.userId)
      .maybeSingle();

    if (pErr || !dbProfile) {
      return NextResponse.json({
        success: true,
        profile: {
          id: ctx.userId,
          user_id: ctx.userId,
          full_name: 'User',
          email: '',
          avatar_url: null,
          role: ctx.role,
          account_id: ctx.accountId,
          account_role: ctx.role,
          is_super_admin: false,
        },
      });
    }

    return NextResponse.json({
      success: true,
      profile: {
        id: dbProfile.id || dbProfile.user_id,
        user_id: dbProfile.user_id,
        full_name: dbProfile.full_name || 'User',
        email: dbProfile.email,
        avatar_url: dbProfile.avatar_url || null,
        role: dbProfile.role || ctx.role || 'owner',
        account_id: dbProfile.account_id || ctx.accountId,
        account_role: dbProfile.account_role || ctx.role || 'owner',
        is_super_admin: Boolean(dbProfile.is_super_admin),
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

    const supabase = getSupabaseAdminClient();
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (name) updates.full_name = name;
    if (email) updates.email = email;
    if (avatarUrl !== undefined) updates.avatar_url = avatarUrl;

    const { data: updatedProfile, error: updateErr } = await supabase
      .from('profiles')
      .update(updates)
      .eq('user_id', ctx.userId)
      .select()
      .maybeSingle();

    if (updateErr || !updatedProfile) {
      return NextResponse.json(
        { error: updateErr?.message || 'Failed to update profile' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      profile: {
        id: updatedProfile.id || updatedProfile.user_id,
        user_id: updatedProfile.user_id,
        full_name: updatedProfile.full_name || 'User',
        email: updatedProfile.email,
        avatar_url: updatedProfile.avatar_url || null,
        role: updatedProfile.role || ctx.role || 'owner',
        account_id: updatedProfile.account_id || ctx.accountId,
        account_role: updatedProfile.account_role || ctx.role || 'owner',
        is_super_admin: Boolean(updatedProfile.is_super_admin),
      },
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
