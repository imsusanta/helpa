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
    const rateLimit = checkRateLimit(`login_${ip}`, RATE_LIMITS.auth);
    if (!rateLimit.success) {
      return rateLimitResponse(rateLimit);
    }

    const body = await request.json().catch(() => ({}));
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Invalid credentials provided.' },
        { status: 400 }
      );
    }

    const trimmedEmail = email.trim().toLowerCase();

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    });

    if (error || !data.user) {
      return NextResponse.json(
        { success: false, error: 'Invalid credentials provided.' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      redirect: '/dashboard',
      user: { id: data.user.id, email: data.user.email },
    });
  } catch (error) {
    console.error('[POST /api/auth/login] error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'An unexpected authentication error occurred.',
      },
      { status: 500 }
    );
  }
}
