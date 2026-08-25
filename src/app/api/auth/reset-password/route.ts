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
    const rateLimit = await checkRateLimit(`reset_pwd_${ip}`, RATE_LIMITS.auth);
    if (!rateLimit.success) {
      return rateLimitResponse(rateLimit);
    }

    const body = await request.json().catch(() => ({}));
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email address is required.' },
        { status: 400 }
      );
    }

    const trimmedEmail = email.trim().toLowerCase();
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL || 'https://www.helpa.studio';

    try {
      const supabase = await createSupabaseServerClient();
      await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: `${siteUrl}/reset-password`,
      });
    } catch (err) {
      console.warn('[Reset Password] Supabase reset error:', err);
    }

    // Anti-enumeration: always return generic success message
    return NextResponse.json({
      success: true,
      message:
        'If an account exists with this email, a password reset link has been sent.',
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        error:
          (err as Error).message || 'Server error sending password reset link.',
      },
      { status: 500 }
    );
  }
}
