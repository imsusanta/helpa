import { NextResponse } from 'next/server';

const APPWRITE_ENDPOINT = 'https://sgp.cloud.appwrite.io/v1';
const APPWRITE_PROJECT_ID = '6a79822b003adde92f63';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required.' },
        { status: 400 }
      );
    }

    const trimmedEmail = email.trim().toLowerCase();

    // Call Appwrite REST API directly to create an email session
    const appwriteRes = await fetch(`${APPWRITE_ENDPOINT}/account/sessions/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Appwrite-Project': APPWRITE_PROJECT_ID,
      },
      body: JSON.stringify({
        email: trimmedEmail,
        password,
      }),
    });

    const appwriteJson = await appwriteRes.json();

    if (!appwriteRes.ok) {
      return NextResponse.json(
        {
          success: false,
          error:
            appwriteJson.message ||
            'Invalid login credentials. Please check your email and password.',
        },
        { status: appwriteRes.status >= 400 && appwriteRes.status < 500 ? 401 : 500 }
      );
    }

    const sessionSecret = appwriteJson.secret || appwriteJson.$id;
    const userId = appwriteJson.userId || appwriteJson.$id;

    const response = NextResponse.json({
      success: true,
      redirect: '/dashboard',
      user: {
        id: userId,
        email: trimmedEmail,
      },
    });

    const cookieOptions = {
      httpOnly: false,
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
        error: (err as Error).message || 'Server error during authentication.',
      },
      { status: 500 }
    );
  }
}
