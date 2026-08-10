import { NextResponse } from 'next/server';

const APPWRITE_ENDPOINT =
  process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ||
  'https://sgp.cloud.appwrite.io/v1';
const APPWRITE_PROJECT_ID =
  process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || '6a79822b003adde92f63';

function generateUniqueId() {
  return (
    'usr_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  );
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { email, password, fullName, name } = body;
    const userName = name || fullName || '';

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required.' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 6 characters.' },
        { status: 400 }
      );
    }

    const trimmedEmail = email.trim().toLowerCase();

    // 1. Create account via Appwrite REST API
    const createRes = await fetch(`${APPWRITE_ENDPOINT}/account`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Appwrite-Project': APPWRITE_PROJECT_ID,
        'X-SDK-Platform': 'client',
      },
      body: JSON.stringify({
        userId: generateUniqueId(),
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
          error: createJson.message || 'Failed to create account in Appwrite.',
        },
        {
          status: createRes.status >= 400 && createRes.status < 500 ? 400 : 500,
        }
      );
    }

    // 2. Automatically log in to obtain session
    const sessionRes = await fetch(
      `${APPWRITE_ENDPOINT}/account/sessions/email`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Appwrite-Project': APPWRITE_PROJECT_ID,
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

    const sessionSecret = sessionJson.secret || sessionJson.$id;
    const userId = sessionJson.userId || sessionJson.$id;

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

    response.cookies.set(
      `a_session_${APPWRITE_PROJECT_ID}`,
      sessionSecret,
      cookieOptions
    );
    response.cookies.set('appwrite_session', sessionSecret, cookieOptions);

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
