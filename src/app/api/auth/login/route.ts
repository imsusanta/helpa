import { NextResponse } from 'next/server';
import { APPWRITE_CONFIG } from '@/infrastructure/appwrite/config';
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

    // Call Appwrite REST API to create an email session
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

    const appwriteJson = await appwriteRes.json();

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

    const sessionSecret = appwriteJson.secret;
    const userId = appwriteJson.userId;

    if (!sessionSecret) {
      return NextResponse.json(
        { success: false, error: 'Authentication failed.' },
        { status: 500 }
      );
    }

    const response = NextResponse.json({
      success: true,
      redirect: '/dashboard',
      user: {
        id: userId,
        email: trimmedEmail,
      },
      sessionSecret,
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
    response.cookies.set('appwrite_session', sessionSecret, cookieOptions);

    return response;
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: 'An unexpected authentication error occurred.',
      },
      { status: 500 }
    );
  }
}
