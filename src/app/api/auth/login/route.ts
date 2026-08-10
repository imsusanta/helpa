import { NextResponse } from 'next/server';
import { getAppwriteAdminClient } from '@/infrastructure/appwrite/server';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required.' },
        { status: 400 }
      );
    }

    const { users } = getAppwriteAdminClient();

    let userList;
    try {
      userList = await users.list();
    } catch (err: unknown) {
      return NextResponse.json(
        {
          success: false,
          error:
            (err as Error).message ||
            'Failed to query user directory in Appwrite.',
        },
        { status: 500 }
      );
    }

    const targetUser = userList.users.find(
      (u) => u.email.toLowerCase() === email.trim().toLowerCase()
    );

    if (!targetUser) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Invalid login credentials. Please check your email and password.',
        },
        { status: 401 }
      );
    }

    const response = NextResponse.json({
      success: true,
      redirect: '/dashboard',
      user: {
        id: targetUser.$id,
        email: targetUser.email,
        name: targetUser.name,
      },
    });

    response.cookies.set('appwrite_session', targetUser.$id, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });

    response.cookies.set('a_session_6a79822b003adde92f63', targetUser.$id, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });

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
