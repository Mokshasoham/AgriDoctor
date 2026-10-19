import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pohnkzwdprodcodkfdze.supabase.co'
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'sb_publishable_3l165GUIHt6zY6xoLt6Q2Q_qvVR6Apy'

// Routes that do NOT require auth.
const PUBLIC_PATHS = ['/login', '/signup', '/auth', '/favicon.ico']

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  if (!supabaseUrl || !supabaseKey || supabaseUrl.includes('placeholder')) {
    return response
  }

  const pathname = request.nextUrl.pathname
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))
  const isApi = pathname.startsWith('/api/')
  const isNextInternal =
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/static/') ||
    pathname.startsWith('/assets/')

  // Fast path: static assets and internal Next.js files don't need auth checks
  if (isNextInternal) {
    return response
  }

  // Fast path: check if any Supabase auth cookie exists before doing any remote network call
  const allCookies = request.cookies.getAll()
  const hasAuthCookie = allCookies.some(
    (c) => c.name.startsWith('sb-') && c.name.includes('-auth-token')
  )

  // If no auth cookie exists:
  // - If it's a public route (e.g. /login), let them through immediately with 0ms network delay
  // - If it's an API route, let the API route handle its own auth
  // - If it's a protected page, redirect straight to /login without hanging on Supabase network calls
  if (!hasAuthCookie) {
    if (isPublic || isApi) {
      return response
    }
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
  }

  try {
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    })

    // Timeout after 2000ms so edge middleware NEVER triggers 504 MIDDLEWARE_INVOCATION_TIMEOUT
    const getUserWithTimeout = Promise.race([
      supabase.auth.getUser(),
      new Promise<{ data: { user: null }; error: Error }>((_, reject) =>
        setTimeout(() => reject(new Error('Supabase auth timeout')), 2000)
      ),
    ])

    const {
      data: { user },
    } = await getUserWithTimeout

    if (!user && !isPublic && !isApi) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('redirect', pathname)
      return NextResponse.redirect(url)
    }

    if (user && (pathname === '/login' || pathname === '/signup')) {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      url.searchParams.delete('redirect')
      return NextResponse.redirect(url)
    }
  } catch (error) {
    console.warn('Supabase middleware bypass/timeout:', error)
    // If not public and auth timed out or threw, safely redirect to login instead of crashing with 504
    if (!isPublic && !isApi) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('redirect', pathname)
      return NextResponse.redirect(url)
    }
  }

  return response
}

