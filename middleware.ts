import { NextResponse, NextRequest } from 'next/server'
import { updateSession } from './utils/supabase/middleware'
import { createServerClient } from '@supabase/ssr'

export async function middleware(req: NextRequest) {
  // Update session and refresh cookies
  const supabaseResponse = await updateSession(req)

  // Skip access check for public routes
  const { pathname } = req.nextUrl
  if (pathname === '/login' || pathname === '/signup' || pathname === '/easy-login' || pathname === '/verify') {
    return supabaseResponse
  }

  // Check access state for authenticated routes
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return req.cookies.getAll()
          },
        },
      }
    )

    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (user && !userError) {
      // Check user_roles status with deletion metadata
      const { data: userRole, error: roleError } = await supabase
        .from('user_roles')
        .select('masjid_id, status, deleted_at, deleted_by, deleted_reason')
        .eq('auth_user_id', user.id)
        .single()

      if (roleError || !userRole) {
        const loginUrl = new URL('/login', req.url)
        loginUrl.searchParams.set('reason', 'no_role')
        return NextResponse.redirect(loginUrl)
      }

      // Check if user role is deleted
      if (userRole.status === 'deleted') {
        const loginUrl = new URL('/login', req.url)
        loginUrl.searchParams.set('reason', 'deleted')
        if (userRole.deleted_by) loginUrl.searchParams.set('deleted_by', userRole.deleted_by)
        if (userRole.deleted_reason) loginUrl.searchParams.set('deleted_reason', userRole.deleted_reason)
        if (userRole.deleted_at) loginUrl.searchParams.set('deleted_at', userRole.deleted_at)
        return NextResponse.redirect(loginUrl)
      }

      // Check if masjid is deleted with deletion metadata
      const { data: masjid, error: masjidError } = await supabase
        .from('masjids')
        .select('status, deleted_at, deleted_by, deleted_reason')
        .eq('id', userRole.masjid_id)
        .single()

      if (masjidError || !masjid || masjid.status === 'deleted') {
        const loginUrl = new URL('/login', req.url)
        loginUrl.searchParams.set('reason', 'masjid_deleted')
        if (masjid?.deleted_by) loginUrl.searchParams.set('deleted_by', masjid.deleted_by)
        if (masjid?.deleted_reason) loginUrl.searchParams.set('deleted_reason', masjid.deleted_reason)
        if (masjid?.deleted_at) loginUrl.searchParams.set('deleted_at', masjid.deleted_at)
        return NextResponse.redirect(loginUrl)
      }
    }
  } catch (error) {
    // If access check fails, allow request to proceed (fail open)
    console.error('Middleware access check failed:', error)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
