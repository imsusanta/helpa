import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
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

  // Auth pages - redirect to dashboard if already logged in.
  // Exception: when an invite token is in the query string we
  // send the already-signed-in user to /join/<token> instead so
  // they can accept the invitation in one click. Without this,
  // a forwarded invite link to someone who's already signed in
  // would silently drop them on /dashboard.
  if (user && (
    request.nextUrl.pathname === '/login' ||
    request.nextUrl.pathname === '/signup' ||
    request.nextUrl.pathname === '/forgot-password'
  )) {
    const url = request.nextUrl.clone()
    const inviteToken = request.nextUrl.searchParams.get('invite')
    if (
      inviteToken &&
      (request.nextUrl.pathname === '/login' ||
        request.nextUrl.pathname === '/signup')
    ) {
      url.pathname = `/join/${encodeURIComponent(inviteToken)}`
      url.search = ''
    } else {
      url.pathname = '/dashboard'
      url.search = ''
    }
    return NextResponse.redirect(url)
  }

  // Protected pages.
  //
  // This is deliberately a deny-by-default list of PUBLIC paths rather than an
  // allowlist of protected ones. The previous version enumerated 7 protected
  // prefixes while src/app/(dashboard) had grown to 34 route groups, leaving
  // /admin, /patients, /lab-reports, /appointments, /doctors and 22 others
  // reachable without a session. Any new dashboard route is now protected the
  // moment it is created, with no middleware edit required.
  const publicPaths = [
    '/login',
    '/signup',
    '/forgot-password',
    '/reset-password',
    '/auth',      // Supabase auth callbacks
    '/join',      // invitation acceptance (token-authenticated)
    '/privacy',
    '/terms',
  ]
  const { pathname } = request.nextUrl
  const isPublicPath =
    pathname === '/' ||
    publicPaths.some(p => pathname === p || pathname.startsWith(`${p}/`))

  // API routes authenticate themselves and must return JSON 401s rather than
  // an HTML redirect, so they are excluded from the page-redirect rule.
  const isApiPath = pathname.startsWith('/api/')

  if (!user && !isPublicPath && !isApiPath) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    // Preserve the intended destination so login can bounce them back.
    url.search = `?redirectedFrom=${encodeURIComponent(pathname)}`
    return NextResponse.redirect(url)
  }

  // API routes that need auth (not webhooks)
  if (!user && request.nextUrl.pathname.startsWith('/api/whatsapp/') &&
      !request.nextUrl.pathname.includes('/webhook')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
