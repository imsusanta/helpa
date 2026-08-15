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
    const rateLimit = checkRateLimit(`signup_${ip}`, RATE_LIMITS.auth);
    if (!rateLimit.success) {
      return rateLimitResponse(rateLimit);
    }

    const body = await request.json().catch(() => ({}));
    const { email, password, fullName, name } = body;
    const userName = name || fullName || '';

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required.' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        {
          success: false,
          error: 'Password must be at least 8 characters long.',
        },
        { status: 400 }
      );
    }

    const trimmedEmail = email.trim().toLowerCase();

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signUp({
      email: trimmedEmail,
      password,
      options: {
        data: {
          full_name: userName,
        },
      },
    });

    if (error) {
      return NextResponse.json(
        {
          success: false,
          error: error.message || 'Failed to create account.',
        },
        { status: 400 }
      );
    }

    if (data?.user) {
      return NextResponse.json({
        success: true,
        redirect: '/dashboard',
        user: {
          id: data.user.id,
          email: data.user.email,
          name: userName,
        },
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Unable to complete signup. Please try again.',
      },
      { status: 400 }
    );
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        error:
          (err as Error).message || 'Server error during account creation.',
      },
      { status: 500 }
    );
  }
}
