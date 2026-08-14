import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { APPWRITE_CONFIG } from '@/infrastructure/appwrite/config';
import { createClient as createSupabaseServerClient } from '@/lib/supabase/server';

export async function POST() {
  // 1. Supabase SignOut
  if (
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    try {
      const supabase = await createSupabaseServerClient();
      await supabase.auth.signOut();
    } catch {
      // Ignore signOut errors
    }
  }

  // 2. Appwrite SignOut
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(
    `a_session_${APPWRITE_CONFIG.projectId}`
  )?.value;

  if (sessionToken && !sessionToken.startsWith('test-')) {
    try {
      await fetch(`${APPWRITE_CONFIG.endpoint}/account/sessions/current`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-Appwrite-Project': APPWRITE_CONFIG.projectId,
          'X-Appwrite-Session': sessionToken,
        },
      });
    } catch {
      // Ignore network failures during logout revocation
    }
  }

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
  return response;
}
