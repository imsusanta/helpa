import { NextResponse } from 'next/server';
import { createClient as createSupabaseServerClient } from '@/lib/supabase/server';
import { APPWRITE_CONFIG } from '@/infrastructure/appwrite/config';
import {
  checkRateLimit,
  rateLimitResponse,
  RATE_LIMITS,
} from '@/lib/rate-limit';

export async function POST(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    const rateLimit = checkRateLimit(`reset_pwd_${ip}`, RATE_LIMITS.auth);
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

    // 1. Try Supabase Auth password reset
    if (
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ) {
      try {
        const supabase = await createSupabaseServerClient();
        await supabase.auth.resetPasswordForEmail(trimmedEmail, {
          redirectTo: `${siteUrl}/reset-password`,
        });
      } catch {
        // Fall through to generic response
      }
    }

    // 2. Trigger Appwrite password recovery email if configured
    try {
      if (APPWRITE_CONFIG.endpoint && APPWRITE_CONFIG.projectId) {
        await fetch(`${APPWRITE_CONFIG.endpoint}/account/recovery`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Appwrite-Project': APPWRITE_CONFIG.projectId,
          },
          body: JSON.stringify({
            email: trimmedEmail,
            url: `${siteUrl}/reset-password`,
          }),
        });
      }
    } catch {
      // Fall through to generic response
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
