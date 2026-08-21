import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { requireSupabasePublicConfig } from '@/lib/runtime-config';

/** Default-deny route protection using Supabase Auth. */
const PUBLIC_EXACT_PATHS = new Set([
  '/',
  '/login',
  '/signup',
  '/forgot-password',
  '/contact',
  '/privacy',
  '/terms',
  '/refund',
  '/robots.txt',
  '/sitemap.xml',
  '/icon',
  '/api/health',
  '/api/whatsapp/webhook',
  '/api/plans',
  '/api/auth/login',
  '/api/auth/signup',
  '/api/auth/logout',
  '/api/auth/reset-password',
  '/api/auth/me',
]);

const PUBLIC_PATH_PREFIXES = [
  '/join/',
  '/api/health',
  '/api/invitations/',
  '/api/auth/',
  '/api/webhooks/',
  '/_next/',
];

function isPublicRoute(pathname: string): boolean {
  if (pathname.startsWith('/api/whatsapp/webhook')) return true;
  if (PUBLIC_EXACT_PATHS.has(pathname)) return true;
  if (PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix)))
    return true;
  return (
    pathname.startsWith('/api/appointments/') && pathname.endsWith('/pdf')
  );
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  let user: { id: string; email?: string } | null = null;
  let response = NextResponse.next({ request });

  try {
    const { url, publishableKey } = requireSupabasePublicConfig();
    const supabase = createServerClient(url, publishableKey, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookies) => {
          cookies.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookies.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    });
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (authUser?.id) user = { id: authUser.id, email: authUser.email };
  } catch {
    // Missing or invalid Supabase configuration fails closed below.
  }

  if (
    user &&
    (pathname === '/login' ||
      pathname === '/signup' ||
      pathname === '/forgot-password')
  ) {
    const url = request.nextUrl.clone();
    const inviteToken = request.nextUrl.searchParams.get('invite');
    if (inviteToken && (pathname === '/login' || pathname === '/signup')) {
      url.pathname = `/join/${encodeURIComponent(inviteToken)}`;
      url.search = '';
    } else {
      url.pathname = '/dashboard';
      url.search = '';
    }
    return NextResponse.redirect(url);
  }

  if (!user && !isPublicRoute(pathname)) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Authentication required' },
        { status: 401 }
      );
    }
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
