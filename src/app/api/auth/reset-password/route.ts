import { NextResponse } from 'next/server';
import { APPWRITE_CONFIG } from '@/infrastructure/appwrite/config';

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
    const recoveryRes = await fetch(
      `${APPWRITE_CONFIG.endpoint}/account/recovery`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Appwrite-Project': APPWRITE_CONFIG.projectId,
        },
        body: JSON.stringify({
          email: trimmedEmail,
          url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://www.helpa.studio'}/reset-password`,
        }),
      }
    );

    const recoveryJson = await recoveryRes.json();

    if (!recoveryRes.ok) {
      return NextResponse.json(
        {
          success: false,
          error:
            recoveryJson.message ||
            'Failed to send password reset link. Account not found.',
        },
        {
          status:
            recoveryRes.status >= 400 && recoveryRes.status < 500 ? 400 : 500,
        }
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
        error:
          (err as Error).message || 'Server error sending password reset link.',
      },
      { status: 500 }
    );
  }
}
