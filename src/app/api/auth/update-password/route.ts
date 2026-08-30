import { NextResponse } from 'next/server';
import { createClient as createSupabaseServerClient } from '@/lib/supabase/server';
import {
  checkRateLimit,
  rateLimitResponse,
  RATE_LIMITS,
} from '@/lib/rate-limit';

export async function POST(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    const rateLimit = await checkRateLimit(
      `update_pwd_${ip}`,
      RATE_LIMITS.auth
    );
    if (!rateLimit.success) {
      return rateLimitResponse(rateLimit);
    }

    const body = await request.json().catch(() => ({}));
    const password =
      typeof body.password === 'string' ? body.password.trim() : '';

    if (!password || password.length < 8) {
      return NextResponse.json(
        {
          success: false,
          error: 'Password must be at least 8 characters long.',
        },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Your password reset session has expired or is invalid. Please request a new link.',
        },
        { status: 401 }
      );
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    if (updateError) {
      return NextResponse.json(
        {
          success: false,
          error: updateError.message || 'Failed to update password.',
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Your password has been successfully reset.',
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        error:
          (err as Error).message || 'Server error updating password.',
      },
      { status: 500 }
    );
  }
}
