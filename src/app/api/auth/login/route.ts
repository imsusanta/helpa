import { NextResponse } from 'next/server';
import { createClient as createSupabaseServerClient } from '@/lib/supabase/server';
import { APPWRITE_CONFIG } from '@/infrastructure/appwrite/config';
import {
  getRuntimeConfig,
  RuntimeConfigurationError,
} from '@/lib/runtime-config';
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

    const runtime = getRuntimeConfig();
    if (runtime.authProvider === 'supabase') {
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
    }

    if (runtime.migrationMode !== 'rollback') {
      return NextResponse.json(
        { success: false, error: 'Authentication provider is unavailable.' },
        { status: 503 }
      );
    }

    // Explicit rollback-only compatibility path. It is never attempted after
    // a Supabase sign-in failure.
    const appwriteRes = await fetch(
      `${APPWRITE_CONFIG.endpoint}/account/sessions/email`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Appwrite-Project': APPWRITE_CONFIG.projectId,
          'X-SDK-Platform': 'client',
        },
        body: JSON.stringify({
          email: trimmedEmail,
          password,
        }),
      }
    );

    const appwriteJson = await appwriteRes.json().catch(() => null);

    if (!appwriteJson || typeof appwriteJson !== 'object') {
      return NextResponse.json(
        {
          success: false,
          error:
            'Authentication provider returned an invalid response structure.',
        },
        { status: 502 }
      );
    }

    if (!appwriteRes.ok) {
      return NextResponse.json(
        {
          success: false,
          error:
            appwriteJson.message ||
            'Invalid credentials provided. Please check your email and password.',
        },
        { status: 401 }
      );
    }

    let sessionSecret =
      typeof appwriteJson.secret === 'string' ? appwriteJson.secret : '';
    if (!sessionSecret) {
      // Extract session secret from Appwrite Set-Cookie header
      const rawCookies =
        typeof appwriteRes.headers.getSetCookie === 'function'
          ? appwriteRes.headers.getSetCookie()
          : [appwriteRes.headers.get('set-cookie') || ''];

      for (const c of rawCookies) {
        if (!c) continue;
        const match = c.match(/a_session_[^=]+=([^;]+)/);
        if (match) {
          sessionSecret = decodeURIComponent(match[1]);
          break;
        }
      }
    }

    const userId =
      typeof appwriteJson.userId === 'string'
        ? appwriteJson.userId
        : appwriteJson.$id;

    if (
      !userId ||
      typeof userId !== 'string' ||
      !/^[a-zA-Z0-9_\-\.]{1,64}$/.test(userId)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid user identifier in authentication response.',
        },
        { status: 502 }
      );
    }

    // Strict validation: format check
    if (!sessionSecret || !/^[a-zA-Z0-9_\-\.]{32,512}$/.test(sessionSecret)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication failed. Invalid session format.',
        },
        { status: 401 }
      );
    }

    // Cryptographic validation: Verify session with Appwrite account endpoint before setting cookie
    try {
      const verifyRes = await fetch(`${APPWRITE_CONFIG.endpoint}/account`, {
        method: 'GET',
        headers: {
          'X-Appwrite-Project': APPWRITE_CONFIG.projectId,
          'X-Appwrite-Session': sessionSecret,
        },
      });

      if (!verifyRes.ok) {
        return NextResponse.json(
          {
            success: false,
            error:
              'Authentication verification failed. Session could not be validated.',
          },
          { status: 401 }
        );
      }

      const verifyData = await verifyRes.json();
      if (
        (userId && verifyData.$id !== userId) ||
        verifyData.email?.toLowerCase() !== trimmedEmail
      ) {
        return NextResponse.json(
          {
            success: false,
            error: 'Authentication verification mismatch.',
          },
          { status: 401 }
        );
      }
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication service verification unavailable.',
        },
        { status: 503 }
      );
    }

    const response = NextResponse.json({
      success: true,
      redirect: '/dashboard',
      user: {
        id: userId,
        email: trimmedEmail,
      },
    });

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    };

    response.cookies.set(
      `a_session_${APPWRITE_CONFIG.projectId}`,
      sessionSecret,
      cookieOptions
    );
    return response;
  } catch (error) {
    if (error instanceof RuntimeConfigurationError) {
      return NextResponse.json(
        { success: false, error: 'Authentication provider is unavailable.' },
        { status: 503 }
      );
    }
    return NextResponse.json(
      {
        success: false,
        error: 'An unexpected authentication error occurred.',
      },
      { status: 500 }
    );
  }
}
