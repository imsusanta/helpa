import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') || '/reset-password';
  const error = requestUrl.searchParams.get('error');
  const errorDescription = requestUrl.searchParams.get('error_description');

  if (error || errorDescription) {
    const errorMsg = errorDescription || error || 'Authentication link error';
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(errorMsg)}`, request.url)
    );
  }

  if (code) {
    try {
      const supabase = await createClient();
      const { error: exchangeError } =
        await supabase.auth.exchangeCodeForSession(code);

      if (!exchangeError) {
        // Redirect to the intended destination (e.g. /reset-password)
        const forwardUrl = new URL(next, request.url);
        return NextResponse.redirect(forwardUrl);
      } else {
        console.error('[Auth Callback] Code exchange failed:', exchangeError);
        return NextResponse.redirect(
          new URL(
            `/login?error=${encodeURIComponent(exchangeError.message || 'Invalid or expired auth code.')}`,
            request.url
          )
        );
      }
    } catch (err) {
      console.error('[Auth Callback] Unexpected error during exchange:', err);
      return NextResponse.redirect(
        new URL('/login?error=Authentication+failed', request.url)
      );
    }
  }

  // If no code provided, redirect to home or login
  return NextResponse.redirect(new URL(next, request.url));
}
