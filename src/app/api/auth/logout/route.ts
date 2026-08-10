import { NextResponse } from 'next/server';
import { APPWRITE_CONFIG } from '@/infrastructure/appwrite/config';

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

  response.cookies.set(
    `a_session_${APPWRITE_CONFIG.projectId}`,
    '',
    cookieOptions
  );
  response.cookies.set('appwrite_session', '', cookieOptions);
  response.cookies.set('a_session_legacy', '', cookieOptions);

  return response;
}
