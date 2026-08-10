import { NextResponse } from 'next/server';

const APPWRITE_PROJECT_ID =
  process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || '6a79822b003adde92f63';

export async function POST() {
  const response = NextResponse.json({
    success: true,
    redirect: '/login',
  });

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 0, // expire immediately
  };

  response.cookies.set(`a_session_${APPWRITE_PROJECT_ID}`, '', cookieOptions);
  response.cookies.set('appwrite_session', '', cookieOptions);
  response.cookies.set('a_session_legacy', '', cookieOptions);

  return response;
}
