import { NextResponse } from 'next/server';

const APPWRITE_ENDPOINT =
  process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || 'https://sgp.cloud.appwrite.io/v1';
const APPWRITE_PROJECT_ID =
  process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || '6a79822b003adde92f63';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://helpa.appwrite.network';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email address is required.' },
        { status: 400 }
      );
    }

    const trimmedEmail = email.trim().toLowerCase();

    // Trigger Appwrite password recovery email
    const recoveryRes = await fetch(`${APPWRITE_ENDPOINT}/account/recovery`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Appwrite-Project': APPWRITE_PROJECT_ID,
      },
      body: JSON.stringify({
        email: trimmedEmail,
        url: `${SITE_URL}/forgot-password`,
      }),
    });

    const recoveryJson = await recoveryRes.json();

    if (!recoveryRes.ok) {
      return NextResponse.json(
        {
          success: false,
          error:
            recoveryJson.message ||
            'Failed to send password reset link. Account not found.',
        },
        { status: recoveryRes.status >= 400 && recoveryRes.status < 500 ? 400 : 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Password reset link sent to your email.',
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: (err as Error).message || 'Server error sending password reset link.',
      },
      { status: 500 }
    );
  }
}
