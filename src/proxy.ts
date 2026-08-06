import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Default-Deny Route Protection Middleware
 *
 * All application routes and API endpoints require authentication by default,
 * except explicitly listed public routes (auth, landing, legal, webhooks, static assets).
 */

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
  '/api/whatsapp/webhook',
  '/api/plans',
])

const PUBLIC_PATH_PREFIXES = [
  '/join/',
  '/api/invitations/',
  '/_next/',
]

function isPublicRoute(pathname: string): boolean {
  if (pathname.startsWith('/api/whatsapp/webhook')) return true
  if (PUBLIC_EXACT_PATHS.has(pathname)) return true
  if (PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return true
  // Allow public appointment PDF access path (it enforces HMAC token / staff session inside route handler)
  if (pathname.startsWith('/api/appointments/') && pathname.endsWith('/pdf')) return true
  return false
}

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname

  // Auth pages - redirect to dashboard if already logged in.
  if (user && (
    pathname === '/login' ||
    pathname === '/signup' ||
    pathname === '/forgot-password'
  )) {
    const url = request.nextUrl.clone()
    const inviteToken = request.nextUrl.searchParams.get('invite')
    if (
      inviteToken &&
      (pathname === '/login' || pathname === '/signup')
    ) {
      url.pathname = `/join/${encodeURIComponent(inviteToken)}`
      url.search = ''
    } else {
      url.pathname = '/dashboard'
      url.search = ''
    }
    return NextResponse.redirect(url)
  }

  // Default-Deny: Unauthenticated access to non-public paths
  if (!user && !isPublicRoute(pathname)) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Authentication required' },
        { status: 401 }
      )
    }
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
