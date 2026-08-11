import { NextResponse } from 'next/server';
import { APPWRITE_CONFIG } from '@/infrastructure/appwrite/config';
import {
  checkRateLimit,
  rateLimitResponse,
  RATE_LIMITS,
} from '@/lib/rate-limit';
import { ID } from 'node-appwrite';

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

    // 1. Create account via Appwrite REST API
    const createRes = await fetch(`${APPWRITE_CONFIG.endpoint}/account`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Appwrite-Project': APPWRITE_CONFIG.projectId,
        'X-SDK-Platform': 'client',
      },
      body: JSON.stringify({
        userId: ID.unique(),
        email: trimmedEmail,
        password,
        name: userName,
      }),
    });

    const createJson = await createRes.json();

    if (!createRes.ok && createJson.type !== 'user_already_exists') {
      return NextResponse.json(
        {
          success: false,
          error: createJson.message || 'Failed to create account.',
        },
        {
          status: createRes.status >= 400 && createRes.status < 500 ? 400 : 500,
        }
      );
    }

    // 2. Automatically log in to obtain session
    const sessionRes = await fetch(
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

    const sessionJson = await sessionRes.json();

    if (!sessionRes.ok) {
      return NextResponse.json({
        success: true,
        message: 'Account created successfully. Please sign in.',
        redirect: '/login',
      });
    }

    let sessionSecret = sessionJson.secret || '';
    if (!sessionSecret) {
      const rawCookies =
        typeof sessionRes.headers.getSetCookie === 'function'
          ? sessionRes.headers.getSetCookie()
          : [sessionRes.headers.get('set-cookie') || ''];

      for (const c of rawCookies) {
        if (!c) continue;
        const match = c.match(/a_session_[^=]+=([^;]+)/);
        if (match) {
          sessionSecret = decodeURIComponent(match[1]);
          break;
        }
      }
    }
    const userId = sessionJson.userId;

    const response = NextResponse.json({
      success: true,
      redirect: '/dashboard',
      user: {
        id: userId,
        email: trimmedEmail,
        name: userName,
      },
    });

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    };

    if (sessionSecret) {
      response.cookies.set(
        `a_session_${APPWRITE_CONFIG.projectId}`,
        sessionSecret,
        cookieOptions
      );
      response.cookies.set('appwrite_session', sessionSecret, cookieOptions);
    }

    return response;
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
