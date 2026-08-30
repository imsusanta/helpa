import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import {
  getRuntimeConfig,
  requireSupabasePublicConfig,
} from '@/lib/runtime-config';

/**
 * Default-Deny Route Protection Proxy (Next.js 16 Proxy Convention)
 *
 * All application routes and API endpoints require authentication by default,
 * except explicitly listed public routes (auth, landing, legal, webhooks, health, static assets).
 */

const PUBLIC_EXACT_PATHS = new Set([
  '/',
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
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
  '/api/auth/update-password',
  '/api/auth/me',
]);

const PRIVATE_CACHE_HEADERS = {
  'Cache-Control': 'private, no-store, no-cache, must-revalidate',
} as const;

const PUBLIC_PATH_PREFIXES = [
  '/join/',
  '/f/',
  '/proposal/',
  '/auth/',
  '/api/health',
  '/api/invitations/',
  '/api/auth/',
  '/api/webhooks/',
  '/api/public/',
  '/_next/',
];

export function isPublicRoute(pathname: string): boolean {
  if (pathname.startsWith('/api/whatsapp/webhook')) return true;
  if (PUBLIC_EXACT_PATHS.has(pathname)) return true;
  if (PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix)))
    return true;
  if (pathname.startsWith('/api/appointments/') && pathname.endsWith('/pdf'))
    return true;
  return false;
}

export async function proxy(request: NextRequest) {
  let user: { id: string; email?: string } | null = null;
  try {
    const runtime = getRuntimeConfig();
    if (runtime.authProvider === 'supabase') {
      const { url, publishableKey } = requireSupabasePublicConfig();
      let response = NextResponse.next({ request });
      const supabase = createServerClient(url, publishableKey, {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: (cookies) => {
            cookies.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            );
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
      if (authUser?.id) {
        user = {
          id: authUser.id,
          email: authUser.email,
        };
      }
      // The refreshed cookie response is used below for authenticated requests.
      if (user && !isPublicRoute(request.nextUrl.pathname)) return response;
    }
  } catch {
    // Missing/invalid runtime configuration fails closed for protected routes.
  }

  const pathname = request.nextUrl.pathname;

  // Auth pages - redirect to dashboard if already logged in.
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

  // Default-Deny: Unauthenticated access to non-public paths
  if (!user && !isPublicRoute(pathname)) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Authentication required' },
        { status: 401, headers: PRIVATE_CACHE_HEADERS }
      );
    }
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url, { headers: PRIVATE_CACHE_HEADERS });
  }

  return NextResponse.next({ request });
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
