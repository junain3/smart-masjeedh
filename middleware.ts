import { createClient } from '@supabase/supabase-js'
import { NextResponse, NextRequest } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function middleware(req: NextRequest) {
  console.log('DEBUG: Middleware running for:', req.nextUrl.pathname)
  
  // Get session
  const { data: { session }, error } = await supabase.auth.getSession()
  
  if (error) {
    console.error('DEBUG: Middleware session error:', error)
    return NextResponse.next()
  }

  // If no session, allow access to login page
  if (!session) {
    if (req.nextUrl.pathname !== '/login') {
      console.log('DEBUG: No session, redirecting to login')
      return NextResponse.redirect(new URL('/login', req.url))
    }
    return NextResponse.next()
  }

  // If user has session, check if they have masjid setup
  try {
    const { data: userRole, error: roleError } = await supabase
      .from('user_roles')
      .select('masjid_id')
      .eq('auth_user_id', session.user.id)
      .single()

    if (roleError) {
      console.log('DEBUG: No user_roles found, checking user_id column')
      // Try with user_id column
      const { data: userRole2, error: roleError2 } = await supabase
        .from('user_roles')
        .select('masjid_id')
        .eq('user_id', session.user.id)
        .single()

      if (roleError2 || !userRole2) {
        console.log('DEBUG: No masjid setup, redirecting to setup')
        if (req.nextUrl.pathname !== '/setup-masjid') {
          return NextResponse.redirect(new URL('/setup-masjid', req.url))
        }
        return NextResponse.next()
      }

      // User has masjid setup, redirect to dashboard
      if (req.nextUrl.pathname !== '/dashboard') {
        console.log('DEBUG: User has masjid, redirecting to dashboard')
        return NextResponse.redirect(new URL('/dashboard', req.url))
      }
      return NextResponse.next()
    }

    // User has masjid setup, redirect to dashboard
    if (req.nextUrl.pathname !== '/dashboard') {
      console.log('DEBUG: User has masjid, redirecting to dashboard')
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }
    return NextResponse.next()

  } catch (error) {
    console.error('DEBUG: Middleware error:', error)
    return NextResponse.next()
  }
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
